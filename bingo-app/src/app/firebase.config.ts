import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyCdIBE_NlUS9yoFzc4m48CPU933qJAV56g",
    authDomain: "rosita-casinos.firebaseapp.com",
    projectId: "rosita-casinos",
    storageBucket: "rosita-casinos.firebasestorage.app",
    messagingSenderId: "983562277936",
    appId: "1:983562277936:web:07d13474ba011dc91289f5"
};

console.log('🔥 Inicializando Firebase con proyecto:', firebaseConfig.projectId);
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
console.log('✅ Firestore inicializado correctamente');
