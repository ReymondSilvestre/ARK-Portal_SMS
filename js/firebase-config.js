<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyDlyAR8bqwHpai2gTc8ZZRYoxavOHPTK4w",
    authDomain: "ark-portal-sms.firebaseapp.com",
    projectId: "ark-portal-sms",
    storageBucket: "ark-portal-sms.firebasestorage.app",
    messagingSenderId: "805706470952",
    appId: "1:805706470952:web:86d27f38199c32b8dcc71d",
    measurementId: "G-W2B5TKXXHY"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>