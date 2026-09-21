import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const db = createClient(URL, SERVICE, { auth: { persistSession: false } })
const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }

const EVALUATION_CRITERIA = [
  'Aptitude à travailler sans contrôle', 'Efficacité', 'Esprit pratique', 'Souci de perfectionnement',
  "Rapidité d'exécution", 'Qualité du travail', "Sens de l'organisation", 'Initiative', 'Caractère',
  'Relation avec le personnel infirmier', 'Contact avec les autres agents du service',
  'Contact avec l’encadrement', 'Disponibilité', 'Discrétion', 'Attitude envers les visiteurs',
  'Utilisation du temps de travail', 'Attitude générale', 'Propreté dans la tenue', 'Régularité',
  'Ponctualité / assiduité'
]

const OBSERVATION_FIELDS = [
  'Observations I — Aptitude au service', 'Observations II — Exécution du travail',
  'Observations III — Travail en commun', 'Observations IV — Comportement envers les malades',
  'Observations V — Tenue, ponctualité, assiduité', 'Observations générales'
]

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

function hex(a: ArrayBuffer) {
  return [...new Uint8Array(a)].map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Text(value: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
}

async function sha256Bytes(value: ArrayBuffer) {
  return hex(await crypto.subtle.digest('SHA-256', value))
}

function clean(value: unknown, max = 10000) {
  return String(value ?? '').trim().slice(0, max)
}

function normalize(value: unknown) {
  return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function sourceKey(nom: unknown, prenom: unknown) {
  return [normalize(nom), normalize(prenom)].filter(Boolean).join('_').replace(/\s+/g, '_')
}

function isoDate(value: unknown) {
  const valueText = clean(value)
  const iso = valueText.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const french = valueText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  return french ? `${french[3]}-${french[2].padStart(2, '0')}-${french[1].padStart(2, '0')}` : null
}

function isoTimestamp(value: unknown) {
  const v = clean(value)
  if (!v) return null
  const french = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (french) {
    return new Date(Date.UTC(
      Number(french[3]), Number(french[2]) - 1, Number(french[1]),
      Number(french[4] || 0), Number(french[5] || 0), Number(french[6] || 0)
    )).toISOString()
  }
  const candidate = v.includes('T') ? v : v.replace(' ', 'T')
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(candidate) ? candidate : candidate + 'Z')
  return Number.isNaN(d.valueOf()) ? null : d.toISOString()
}

function driveId(url: unknown) {
  const m = clean(url).match(/\/d\/([^/]+)/)
  return m ? m[1] : ''
}

function parseCsv(input: string) {
  const matrix: string[][] = []
  let row: string[] = [], field = '', quoted = false
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else {
      if (c === '"') quoted = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); matrix.push(row); row = []; field = '' }
      else if (c !== '\r') field += c
    }
  }
  if (field || row.length) { row.push(field); matrix.push(row) }
  if (!matrix.length) return []
  let headers = matrix[0].map(value => clean(value))
  let offset = 0
  if (!headers[0]) { headers = headers.slice(1); offset = 1 }
  return matrix.slice(1).filter(r => r.some(x => clean(x))).map(r => {
    const out: Record<string, string> = {}
    headers.forEach((h, i) => { if (h) out[h] = r[i + offset] ?? '' })
    return out
  })
}

async function sheetRows(spreadsheetId: string, sheetName: string) {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
  const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'STIP-Onboarding-Sync/1.0' } })
  if (!r.ok) throw new Error(`SOURCE_INDISPONIBLE:${sheetName}:${r.status}`)
  const body = await r.text()
  if (/<!doctype html|<html/i.test(body.slice(0, 300))) throw new Error(`SOURCE_NON_PUBLIQUE:${sheetName}`)
  return parseCsv(body)
}

async function authenticated(req: Request) {
  const token = req.headers.get('x-stip-sync-token') || ''
  if (token.length < 40) return false
  const hash = await sha256Text(token)
  const { data, error } = await db.from('stip_onboarding_sync_tokens')
    .select('active,expires_at').eq('token_hash', hash).maybeSingle()
  if (error) throw error
  return !!data?.active && (!data.expires_at || new Date(data.expires_at) > new Date())
}

async function importRow(batchId: string, entity: string, key: string, status: string, payload: unknown, targetId?: string, errorMessage?: string) {
  await db.from('stip_onboarding_import_rows').upsert({
    batch_id: batchId,
    entity_type: entity,
    source_row_key: key,
    status,
    payload,
    target_id: targetId || null,
    error_message: errorMessage || null
  }, { onConflict: 'batch_id,entity_type,source_row_key' })
}

async function agentMap() {
  const [{ data, error }, { data: aliases, error: aliasError }] = await Promise.all([
    db.from('agents').select('id,source_key,nom,prenom,actif'),
    db.from('stip_agent_identity_aliases').select('incoming_source_key,canonical_agent_id').eq('active', true)
  ])
  if (error) throw error
  if (aliasError) throw aliasError
  const map = new Map<string, any>()
  const byId = new Map<string, any>()
  for (const agent of data || []) {
    byId.set(String(agent.id), agent)
    if (agent.source_key) map.set(normalize(agent.source_key).replace(/\s+/g, '_'), agent)
    map.set(normalize(agent.nom), agent)
    map.set(normalize([agent.nom, agent.prenom].filter(Boolean).join(' ')), agent)
    map.set(normalize([agent.prenom, agent.nom].filter(Boolean).join(' ')), agent)
  }
  for (const item of aliases || []) {
    const agent = byId.get(String(item.canonical_agent_id))
    if (!agent) continue
    const incoming = normalize(item.incoming_source_key)
    if (incoming) {
      map.set(incoming, agent)
      map.set(incoming.replace(/\s+/g, '_'), agent)
      map.set(incoming.replace(/_/g, ' '), agent)
    }
  }
  return map
}

function findAgent(map: Map<string, any>, nom: unknown, prenom: unknown) {
  const direct = sourceKey(nom, prenom)
  return map.get(direct) || map.get(normalize([nom, prenom].filter(Boolean).join(' '))) || null
}

function safeAgentName(agent: any, fallback = '') {
  return agent ? [agent.prenom, agent.nom].filter(Boolean).join(' ').trim() : clean(fallback)
}

async function syncManagers(rows: Record<string, string>[], agents: Map<string, any>, counts: any, batchId: string) {
  if (!rows.length || !('Nom' in rows[0]) || !('Prénom' in rows[0]) || !('Suivi des agents' in rows[0])) {
    throw new Error('SOURCE_ANNUAIRE_INVALIDE')
  }
  const authorized = new Set<string>()
  for (const row of rows) {
    const canManage = normalize(row['Suivi des agents']) === 'ok' || normalize(row['Gestion']) === 'ok'
    if (!canManage) continue
    const agent = findAgent(agents, row['Nom'], row['Prénom'])
    const safePayload = { nom: agent?.nom || row['Nom'], prenom: agent?.prenom || row['Prénom'], poste: row['Poste'], can_manage: true }
    if (!agent) {
      counts.warnings++
      await importRow(batchId, 'manager', sourceKey(row['Nom'], row['Prénom']), 'warning', safePayload, undefined, 'AGENT_STIP_INTROUVABLE')
      continue
    }
    authorized.add(agent.id)
    const { error } = await db.from('stip_onboarding_managers').upsert({
      agent_id: agent.id,
      can_manage_all: true,
      can_evaluate: true,
      active: true,
      source: 'legacy_annuaire',
      source_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'agent_id' })
    if (error) throw error
    counts.managers++
    counts.written++
    await importRow(batchId, 'manager', agent.id, 'imported', safePayload, agent.id)
  }
  if (!authorized.size) throw new Error('AUCUN_RESPONSABLE_DANS_L_ANNUAIRE')
  const { data: current, error } = await db.from('stip_onboarding_managers')
    .select('agent_id').eq('source', 'legacy_annuaire').eq('active', true)
  if (error) throw error
  const disabled = (current || []).filter(x => !authorized.has(x.agent_id)).map(x => x.agent_id)
  if (disabled.length) {
    const { error: disableError } = await db.from('stip_onboarding_managers')
      .update({ active: false, updated_at: new Date().toISOString() }).in('agent_id', disabled)
    if (disableError) throw disableError
  }
}

async function syncCases(rows: Record<string, string>[], agents: Map<string, any>, counts: any, batchId: string) {
  if (!rows.length || !('ID_AGENT' in rows[0]) || !('NOM' in rows[0])) throw new Error('SOURCE_AGENTS_INVALIDE')
  const cases = new Map<string, any>()
  for (const row of rows) {
    const legacyId = clean(row['ID_AGENT'])
    if (!legacyId) continue
    counts.read++
    const agent = findAgent(agents, row['NOM'], row['PRENOM'])
    const safePayload = {
      legacy_agent_id: legacyId,
      nom: agent?.nom || row['NOM'], prenom: agent?.prenom || row['PRENOM'], telephone: row['TELEPHONE'], matricule: row['MATRICULE'],
      arrival_date: isoDate(row['DATE_ARRIVEE_STIP']), verification: row['VERIFICATION'],
      legacy_file_id: row['FICHIER_BROUILLON_ID'] || null
    }
    if (!agent) {
      counts.warnings++
      await importRow(batchId, 'case', legacyId, 'warning', safePayload, undefined, 'AGENT_STIP_INTROUVABLE')
      continue
    }
    const { data: existing, error: existingError } = await db.from('stip_onboarding_cases')
      .select('*').eq('legacy_agent_id', legacyId).maybeSingle()
    if (existingError) throw existingError
    let item = existing
    if (!item) {
      const profileData = {
        legacy_nom: agent?.nom || row['NOM'] || '', legacy_prenom: agent?.prenom || row['PRENOM'] || '',
        legacy_phone: row['TELEPHONE'] || '', legacy_matricule: row['MATRICULE'] || ''
      }
      const { data, error } = await db.from('stip_onboarding_cases').insert({
        agent_id: agent.id, status: 'active', arrival_date: isoDate(row['DATE_ARRIVEE_STIP']),
        verification_status: clean(row['VERIFICATION'], 120) || null,
        experience_text: clean(row['EXPERIENCES_PRO']) || null,
        profile_data: profileData, source: 'legacy_drive', legacy_agent_id: legacyId,
        legacy_file_id: clean(row['FICHIER_BROUILLON_ID']) || null,
        legacy_file_url: clean(row['FICHIER_BROUILLON_URL']) || null,
        legacy_updated_at: isoTimestamp(row['MODIFIE_LE'])
      }).select('*').single()
      if (error) throw error
      item = data
      counts.cases++
      counts.written++
    } else if (item.source === 'legacy_drive') {
      const { data, error } = await db.from('stip_onboarding_cases').update({
        legacy_file_id: clean(row['FICHIER_BROUILLON_ID']) || item.legacy_file_id,
        legacy_file_url: clean(row['FICHIER_BROUILLON_URL']) || item.legacy_file_url,
        legacy_updated_at: isoTimestamp(row['MODIFIE_LE']) || item.legacy_updated_at,
        updated_at: new Date().toISOString()
      }).eq('id', item.id).select('*').single()
      if (error) throw error
      item = data
    }
    cases.set(legacyId, item)
    await importRow(batchId, 'case', legacyId, 'imported', safePayload, item.id)
    if (item.legacy_file_id) {
      const { error: documentError } = await db.from('stip_agent_documents').upsert({
        case_id: item.id,
        document_kind: 'legacy_file',
        file_name: `${clean(agent?.nom || row['NOM'])} ${clean(agent?.prenom || row['PRENOM'])} - dossier individuel.xlsx`.trim(),
        mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        immutable: false,
        source: 'legacy_drive',
        legacy_drive_id: item.legacy_file_id,
        legacy_url: item.legacy_file_url || `https://docs.google.com/spreadsheets/d/${item.legacy_file_id}/edit`
      }, { onConflict: 'legacy_drive_id', ignoreDuplicates: true })
      if (documentError && documentError.code !== '23505') throw documentError
    }
  }
  return cases
}

async function syncStages(rows: Record<string, string>[], cases: Map<string, any>, agents: Map<string, any>, counts: any, batchId: string) {
  const keyMap: Record<string, string> = {
    '1er jour': 'premier_jour', 'premier jour': 'premier_jour',
    '1ere semaine': 'premiere_semaine', '1re semaine': 'premiere_semaine',
    'fin de doublure': 'fin_doublure', 'suivi a 1 mois': 'suivi_1_mois',
    'suivi a 3 mois': 'suivi_3_mois', 'suivi a 6 mois': 'suivi_6_mois'
  }
  for (const row of rows) {
    const legacyAgent = clean(row['ID agent'] || row['ID_AGENT'])
    const stageKey = keyMap[normalize(row['Étape'] || row['ETAPE'])]
    const item = cases.get(legacyAgent)
    if (!item || !stageKey) continue
    const final = normalize(row['Statut']) === 'termine'
    const evaluatorAgent = agents.get(normalize(row['Évaluateur'])) || agents.get(normalize(row['Évaluateur']).replace(/\s+/g, '_')) || null
    const safeEvaluator = safeAgentName(evaluatorAgent, row['Évaluateur'])
    const payload = { legacy_status: row['Statut'] || '', legacy_evaluator: safeEvaluator }
    const { data: exists, error: existsError } = await db.from('stip_onboarding_stage_records')
      .select('id,status').eq('case_id', item.id).eq('stage_key', stageKey).eq('version', 1).maybeSingle()
    if (existsError) throw existsError
    if (!exists) {
      const { data, error } = await db.from('stip_onboarding_stage_records').insert({
        case_id: item.id, stage_key: stageKey, version: 1,
        status: final ? 'final' : (normalize(row['Statut']) === 'a faire' ? 'not_started' : 'draft'),
        payload, evaluator_name: safeEvaluator || null,
        validation_date: isoDate(row['Date validation']), source: 'legacy_drive',
        legacy_modified_at: isoTimestamp(row['Modifié le']),
        finalized_at: final ? (isoTimestamp(row['Modifié le']) || new Date().toISOString()) : null
      }).select('id').single()
      if (error) throw error
      counts.stages++
      counts.written++
      await importRow(batchId, 'stage', `${legacyAgent}:${stageKey}`, 'imported', payload, data.id)
    }
  }
}

async function syncEvaluations(rows: Record<string, string>[], cases: Map<string, any>, agents: Map<string, any>, counts: any, batchId: string) {
  if (!rows.length || !('ID évaluation' in rows[0]) || !('ID agent' in rows[0])) throw new Error('SOURCE_EVALUATIONS_INVALIDE')
  for (const row of rows) {
    const legacyId = clean(row['ID évaluation'])
    const legacyAgent = clean(row['ID agent'])
    if (!legacyId || !legacyAgent) continue
    counts.read++
    const item = cases.get(legacyAgent)
    const safePayload = { legacy_evaluation_id: legacyId, legacy_agent_id: legacyAgent, version: row['Version'], status: row['Statut'] }
    if (!item) {
      counts.warnings++
      await importRow(batchId, 'evaluation', legacyId, 'warning', safePayload, undefined, 'DOSSIER_AGENT_INTROUVABLE')
      continue
    }
    const { data: existing, error: existingError } = await db.from('stip_agent_evaluations')
      .select('id').eq('legacy_evaluation_id', legacyId).maybeSingle()
    if (existingError) throw existingError
    let evaluationId = existing?.id
    if (!evaluationId) {
      const criteria = Object.fromEntries(EVALUATION_CRITERIA.map(key => [key, clean(row[key])]))
      const observations = Object.fromEntries(OBSERVATION_FIELDS.map(key => [key, clean(row[key])]))
      const evaluator = findAgent(agents, row['Évaluateur']?.split(' ').slice(-1)[0], row['Évaluateur']?.split(' ').slice(0, -1).join(' '))
        || agents.get(normalize(row['Évaluateur'])) || null
      const status = normalize(row['Statut']) === 'valide' ? 'validated' : 'draft'
      const { data, error } = await db.from('stip_agent_evaluations').insert({
        case_id: item.id, agent_id: item.agent_id, evaluator_agent_id: evaluator?.id || null,
        evaluator_name: safeAgentName(evaluator, row['Évaluateur']) || 'Responsable legacy',
        version: Number(row['Version'] || 1), status,
        evaluation_date: isoDate(row['Date évaluation']) || new Date().toISOString().slice(0, 10),
        service: clean(row['Service']) || null, grade: clean(row['Grade']) || null,
        service_since: isoDate(row['Dans le service depuis le']), decision: clean(row['Aimeriez-vous garder cet agent ?']) || null,
        criteria, observations, snapshot_hash: clean(row['Empreinte SHA-256']) || null,
        model_version: clean(row['Version du modèle officiel']) || null, source: 'legacy_drive',
        legacy_evaluation_id: legacyId, legacy_document_url: clean(row['URL document officiel']) || null,
        legacy_created_at: isoTimestamp(row['Créé le']), legacy_validated_at: isoTimestamp(row['Validé le']),
        created_by_agent_id: evaluator?.id || null,
        created_at: isoTimestamp(row['Créé le']) || new Date().toISOString(),
        updated_at: isoTimestamp(row['Validé le']) || isoTimestamp(row['Créé le']) || new Date().toISOString(),
        validated_at: status === 'validated' ? (isoTimestamp(row['Validé le']) || isoTimestamp(row['Créé le']) || new Date().toISOString()) : null
      }).select('id').single()
      if (error) throw error
      evaluationId = data.id
      counts.evaluations++
      counts.written++
    }
    await importRow(batchId, 'evaluation', legacyId, 'imported', safePayload, evaluationId)
    const subjectAgent = findAgent(agents, row['Nom'], row['Prénom'])
    const pdfId = driveId(row['URL document officiel'])
    if (pdfId) {
      const { error: documentError } = await db.from('stip_agent_documents').upsert({
        case_id: item.id, evaluation_id: evaluationId, document_kind: 'evaluation_pdf',
        file_name: `${clean(subjectAgent?.nom || row['Nom'])} ${clean(subjectAgent?.prenom || row['Prénom'])} - Evaluation v${Number(row['Version'] || 1)}.pdf`.trim(),
        mime_type: 'application/pdf', checksum_sha256: clean(row['Empreinte SHA-256']) || null,
        immutable: false, source: 'legacy_drive', legacy_drive_id: pdfId,
        legacy_url: clean(row['URL document officiel']), source_created_at: isoTimestamp(row['Validé le'])
      }, { onConflict: 'legacy_drive_id', ignoreDuplicates: true })
      if (documentError && documentError.code !== '23505') throw documentError
    }
  }
}

async function syncEvents(rows: Record<string, string>[], cases: Map<string, any>, counts: any, batchId: string) {
  for (const row of rows) {
    const legacyId = clean(row['ID situation'])
    const item = cases.get(clean(row['ID agent']))
    if (!legacyId || !item) continue
    const payload = { impact: row['Impact'] || '', contexte: row['Contexte'] || '', consequence: row['Conséquence'] || '' }
    const { error } = await db.from('stip_onboarding_events').upsert({
      case_id: item.id, event_type: 'situation', title: clean(row['Intitulé'] || row['Impact'] || 'Situation legacy', 250),
      notes: [row['Contexte'], row['Conséquence'], row['Commentaire']].filter(Boolean).join('\n\n').slice(0, 10000) || null,
      occurred_at: isoTimestamp(row['Créé le']) || new Date().toISOString(), source: 'legacy_drive', legacy_event_id: legacyId
    }, { onConflict: 'legacy_event_id', ignoreDuplicates: true })
    if (error && error.code !== '23505') throw error
    counts.events++
    counts.written++
    await importRow(batchId, 'event', legacyId, 'imported', payload)
  }
}

async function copyDocuments(counts: any) {
  const { data: pending, error } = await db.from('stip_agent_documents')
    .select('id,legacy_drive_id,file_name,mime_type,checksum_sha256,document_kind')
    .eq('source', 'legacy_drive').eq('immutable', false).is('storage_path', null)
    .not('legacy_drive_id', 'is', null).order('source_created_at').limit(20)
  if (error) throw error
  for (const document of pending || []) {
    try {
      const isSheet = document.mime_type.includes('spreadsheetml')
      const url = isSheet
        ? `https://docs.google.com/spreadsheets/d/${document.legacy_drive_id}/export?format=xlsx`
        : `https://drive.google.com/uc?export=download&id=${document.legacy_drive_id}`
      const downloaded = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'STIP-Onboarding-Sync/1.0' } })
      if (!downloaded.ok) throw new Error(`TELECHARGEMENT_${downloaded.status}`)
      const bytes = await downloaded.arrayBuffer()
      const probe = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.byteLength, 200)))
      if (/<!doctype html|<html/i.test(probe)) throw new Error('DOCUMENT_NON_TELECHARGEABLE')
      const actualHash = await sha256Bytes(bytes)
      if (document.checksum_sha256 && document.checksum_sha256 !== actualHash) throw new Error('EMPREINTE_DOCUMENT_INVALIDE')
      const safeName = document.file_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 180)
      const path = `legacy/${document.document_kind}/${document.legacy_drive_id}-${safeName}`
      const { error: uploadError } = await db.storage.from('stip-onboarding-documents').upload(path, bytes, {
        contentType: document.mime_type, cacheControl: '3600', upsert: true
      })
      if (uploadError) throw uploadError
      const { error: updateError } = await db.from('stip_agent_documents').update({
        storage_bucket: 'stip-onboarding-documents', storage_path: path,
        byte_size: bytes.byteLength, checksum_sha256: actualHash, immutable: true
      }).eq('id', document.id)
      if (updateError) throw updateError
      counts.documents_copied++
      counts.written++
    } catch (error) {
      counts.warnings++
      counts.document_errors.push({ id: document.id, error: error instanceof Error ? error.message : String(error) })
    }
  }
}

async function runSync() {
  const started = new Date().toISOString()
  const counts: any = { read: 0, written: 0, warnings: 0, managers: 0, cases: 0, stages: 0, evaluations: 0, events: 0, documents_copied: 0, document_errors: [] }
  const { data: state, error: stateError } = await db.from('stip_onboarding_sync_state').select('*').eq('id', 1).single()
  if (stateError) throw stateError
  if (!state.enabled || state.mode !== 'legacy_transition') return { skipped: true, reason: 'SYNC_DESACTIVEE', state }
  await db.from('stip_onboarding_sync_state').update({ last_status: 'running', last_started_at: started, last_error: null, updated_at: started }).eq('id', 1)
  const settings = state.source_settings || {}
  const { data: batch, error: batchError } = await db.from('stip_onboarding_import_batches').insert({
    source: 'legacy_drive_scheduled', status: 'running', started_at: started,
    source_file_id: settings.agents_sheet_id, details: { trigger: 'cron' }
  }).select('id').single()
  if (batchError) throw batchError
  try {
    const [agentsRows, accessRows, stageRows, evaluationRows, eventRows] = await Promise.all([
      sheetRows(settings.agents_sheet_id, settings.agents_sheet_name || 'Agents'),
      sheetRows(settings.agents_sheet_id, settings.access_sheet_name || 'Annuaire'),
      sheetRows(settings.agents_sheet_id, settings.followup_status_sheet_name || 'Suivi étapes').catch(() => []),
      sheetRows(settings.evaluations_sheet_id, settings.evaluations_sheet_name || 'Evaluations'),
      sheetRows(settings.agents_sheet_id, 'Situations sécurisées').catch(() => [])
    ])
    const agents = await agentMap()
    await syncManagers(accessRows, agents, counts, batch.id)
    const cases = await syncCases(agentsRows, agents, counts, batch.id)
    await syncStages(stageRows, cases, agents, counts, batch.id)
    await syncEvaluations(evaluationRows, cases, agents, counts, batch.id)
    await syncEvents(eventRows, cases, counts, batch.id)
    await copyDocuments(counts)
    const completed = new Date().toISOString()
    const status = counts.warnings ? 'completed_with_warnings' : 'completed'
    await db.from('stip_onboarding_import_batches').update({
      status, rows_read: counts.read, rows_written: counts.written, warnings: counts.warnings,
      errors: 0, details: counts, completed_at: completed
    }).eq('id', batch.id)
    await db.from('stip_onboarding_sync_state').update({
      last_status: status, last_completed_at: completed, last_counts: counts,
      last_error: null, updated_at: completed
    }).eq('id', 1)
    return { ok: true, batch_id: batch.id, status, counts }
  } catch (error) {
    const completed = new Date().toISOString()
    const message = error instanceof Error ? error.message : String(error)
    await db.from('stip_onboarding_import_batches').update({ status: 'failed', errors: 1, details: counts, completed_at: completed }).eq('id', batch.id)
    await db.from('stip_onboarding_sync_state').update({ last_status: 'failed', last_completed_at: completed, last_counts: counts, last_error: message, updated_at: completed }).eq('id', 1)
    throw error
  }
}

Deno.serve(async req => {
  if (req.method !== 'POST') return response({ error: 'METHODE_NON_AUTORISEE' }, 405)
  try {
    if (!await authenticated(req)) return response({ error: 'ACCES_REFUSE' }, 401)
    const body = await req.json().catch(() => ({}))
    if (body.action === 'copy_documents') {
      const counts: any = { written: 0, warnings: 0, documents_copied: 0, document_errors: [] }
      await copyDocuments(counts)
      return response({ ok: true, counts })
    }
    if (body.action !== 'sync') return response({ error: 'ACTION_INVALIDE' }, 400)
    return response(await runSync())
  } catch (error) {
    console.error(error)
    return response({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
})
