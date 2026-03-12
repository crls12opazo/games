import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
};

console.log('🔥 Inicializando Firebase con proyecto:', firebaseConfig.projectId);
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
console.log('✅ Firestore inicializado correctamente');
