// Konfigurasi login daring aplikasi WASH PMI - Water for life (Firebase Authentication + Firestore).
//
// PENTING: berkas ini dibaca langsung oleh browser. Jangan menambahkan baris "import ...",
// "initializeApp(...)" atau "getAnalytics(...)" dari contoh Firebase; cukup isi nilai di bawah.
// Pisahkan beberapa email admin dengan KOMA. Daftar admin harus sama dengan Firestore → Rules.
window.TIRTAPLAN_AUTH = {
  firebase: {
    apiKey: "AIzaSyCndGEZn1bQY1etP9HuGpMjdweKdwY-t_I",
    authDomain: "washpipe-93f48.firebaseapp.com",
    projectId: "washpipe-93f48",
    messagingSenderId: "1054406683881"
  },
  adminEmails: ["denekijulianto@gmail.com", "eki_julianto@pmi.or.id"],
};
