// Konfigurasi login daring aplikasi WASH PMI - Water for life (Firebase Authentication + Firestore).
//
// PENTING: berkas ini dibaca langsung oleh browser. Jangan menambahkan baris "import ...",
// "initializeApp(...)" atau "getAnalytics(...)" dari contoh Firebase; cukup isi nilai di bawah.
// Pisahkan beberapa email admin dengan KOMA. Daftar admin harus sama dengan firestore.rules.
window.TIRTAPLAN_AUTH = {
  firebase: {
    apiKey: "AIzaSyCndGEZn1bQY1etP9HuGpMjdweKdwY-t_I",
    authDomain: "washpipeplan.firebaseapp.com",
    projectId: "washpipeplan",
    storageBucket: "washpipeplan.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abc123"
  },
  adminEmails: ["denekijulianto@gmail.com", "eki_julianto@pmi.or.id"],
};
