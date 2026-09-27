# STIP — Icônes canoniques

## Principe

Une signification métier possède une seule clé d’icône canonique.

- Les données métier stockent `icon_key`.
- `public.stip_icon_catalog` définit le pictogramme SVG une seule fois.
- Les anciennes colonnes `icon` / `icone` restent des fallbacks texte de compatibilité, pas la source visuelle principale.
- Le navigateur rend les pictogrammes via `stip-icon-registry.js` / `window.STIPIcons`.
- Ne jamais recopier du SVG complet dans chaque ligne métier.

## Sources actuellement branchées

- `stip_shift_definitions.icon_key`
- `stip_agent_agenda_items.icon_key`
- `contacts_ghe.icon_key`
- `stip_shift_registry.icon_key` est dérivé de `stip_shift_definitions`.

Les triggers base attribuent les clés par défaut aux nouvelles lignes. Une clé personnalisée présente dans le catalogue est conservée : le système reste extensible.

## Sécurité

`stip_icon_catalog.paths` contient seulement des commandes de `path d` SVG.
Le client valide la clé, le `viewBox`, les classes et les chemins avant rendu.
Ne jamais stocker puis injecter du HTML ou un SVG arbitraire depuis Supabase.

## Rendu

- utiliser `STIPIcons.markup(iconKey, fallback, options)` pour une donnée générique ;
- utiliser `STIPShiftRegistry.iconMarkup(code, options)` pour un code planning ;
- charger `stip-icon-registry.js` avant `shift-registry.js` ;
- utiliser la primitive CSS partagée `.stip-icon-svg` ;
- ne pas recréer une bibliothèque locale sur une page.

## Compatibilité

Si le catalogue n’est pas disponible, le fallback texte/emoji reste affichable. Une panne ou un ancien cache ne doit donc jamais rendre un planning illisible.

## Repères initiaux

- RH / OFF / REPOS → `rest-home`
- CP / CA → `leave-island`
- RTT / RTTA / RTA → `time-off`
- Formation → `training`
- Stagiaire → `trainee`
- Médical → `medical`
- Contacts : `person`, `manager`, `service`

Les pictogrammes peuvent évoluer dans le catalogue sans modifier toutes les lignes qui les utilisent.
