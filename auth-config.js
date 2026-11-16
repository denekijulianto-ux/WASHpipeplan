// Konfigurasi login daring TirtaPlan Studio (Firebase Authentication + Firestore).
//
// Selama "firebase" bernilai null, aplikasi memakai MODE LOKAL: akun hanya tersimpan
// di perangkat masing-masing. Untuk membatasi akses semua orang, isi konfigurasi di bawah
// (lihat langkah di README.md, bagian "Login daring"), lalu simpan/commit berkas ini.
window.TIRTAPLAN_AUTH = {
  // Tempel objek firebaseConfig dari Firebase Console (Project settings → Your apps → Web), contoh:
  // firebase: {
  //   apiKey: "AIza...",
  //   authDomain: "nama-proyek.firebaseapp.com",
  //   projectId: "nama-proyek",
  //   storageBucket: "nama-proyek.appspot.com",
  //   messagingSenderId: "1234567890",
  //   appId: "1:1234567890:web:abc123"
  // },
  // Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

window.TIRTAPLAN_AUTH = {
  firebase: {
    apiKey: "AIzaSy...",
    authDomain: "washpipeplan.firebaseapp.com",
    projectId: "washpipeplan",
    storageBucket: "washpipeplan.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abc123"
  },
  adminEmails: ["denekijulianto@gmail.com". "eki_julianto@pmi.or.id"],
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

  // Email admin yang boleh menyetujui pendaftar. Samakan dengan daftar di firestore.rules.
  adminEmails: ['denekijulianto@gmail.com', 'eki_julianto@pmi.or.id'],
};
