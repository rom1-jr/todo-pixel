// Réglages de l'appli : remplace chaque « REMPLACE-MOI » (voir le guide d'installation, parties 4 et 7).
// Ces valeurs ne sont pas secrètes : elles disent seulement à l'appli quel projet Firebase utiliser.
// La sécurité vient des règles Firestore (fichier firestore.rules) : chacun ne voit que ses propres tâches.
// Tant que ce fichier n'est pas rempli, l'appli marche en « mode local » (tâches gardées sur l'appareil).
window.TODO_CONFIG = {
  // Colle ici l'objet firebaseConfig donné par la console Firebase (étape 3.5 du guide).
  firebase: {
    apiKey: "REMPLACE-MOI",
    authDomain: "REMPLACE-MOI.firebaseapp.com",
    projectId: "REMPLACE-MOI",
    storageBucket: "REMPLACE-MOI.firebasestorage.app",
    messagingSenderId: "REMPLACE-MOI",
    appId: "REMPLACE-MOI"
  },
  // Clé PUBLIQUE de notification, générée avec outils/cles-notifications.html (étape 7.1 du guide).
  vapidPublicKey: "REMPLACE-MOI"
};
