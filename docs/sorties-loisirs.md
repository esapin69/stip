# Sorties & loisirs

Application définitive validée par Eddy le 01/10/2026.

Critères : application accessible depuis Applications et Esprit d’équipe ; carte compacte au-dessus de la semaine tant que l’agent n’a pas répondu ; fenêtre centrale proposant plusieurs dates ou un refus explicite ; fermer ne constitue pas une réponse ; validation serveur avant disparition ; réponse modifiable dans l’application ; participants et compteurs communs ; création, modification et annulation par l’organisateur ou un admin ; navigation retour et mobile conservées.

Source canonique : stip_leisure_events et stip_leisure_responses. Le planning professionnel et les retours de formation ne couvrent pas les propositions collectives à dates multiples, d’où une application dédiée. Réutilisations : session STIP, permissions d’équipe, STIPNav, STIPOverlayNav, FormUX standard, thème et signature de carte. leisure-runtime.js fournit la même fenêtre pour l’accueil et l’application. Aucun stockage local des réponses.

Une modification des dates augmente la révision : les réponses précédentes restent consultables, mais l’accueil demande une nouvelle validation. Annuler conserve l’historique. Aucune inscription du tableau papier n’est attribuée automatiquement à un profil sur la seule base d’un prénom.

Premier événement : Foot indoor, 9/16/23/30 octobre 2026. La photo propose Parilly ou Groupama Stadium et plusieurs créneaux dépendant du nombre ; ces informations restent décrites comme à fixer, sans réservation inventée.

Chats par date (01/10/2026) : chaque inscription confirmée ajoute automatiquement l’agent au groupe de cette date. Deux dates = deux groupes. Le lien `stip_leisure_chats` associe sortie/date à une conversation canonique `stip_conversations` ; les membres sont dérivés des réponses, dans la même transaction via triggers SECURITY INVOKER. Un refus ou une date retirée enlève le membre ; réinscrire rejoint le même groupe et son historique. Une révision des dates attend la reconfirmation ; une annulation suspend les accès. Les préférences de lecture et de sourdine restent conservées lors des mises à jour sans changement de groupe.

Raccourcis « Chat du … » : accueil personnel après réponse, carte de l’application, détail de chaque date. Ils ouvrent Communication > DM & groupes sur la conversation. Les groupes restent accessibles dans la liste habituelle. `stip-messages` reste seul responsable des messages, contrôles de membres et notifications. L’accès Communication reste soumis à la permission messages existante ; aucun droit supplémentaire n’est accordé par l’inscription.

Vérifié en transaction annulée : dates distinctes, membres communs d’une même date, retrait/refus/réinscription, conservation lecture/sourdine, révision/annulation, titre/famille et exécution service_role. Aucun compte de test ou message automatique n’est créé en production.
