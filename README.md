# ARK School Management System

Files
- index.html            page layout
- css/style.css         styles
- js/firebase-config.js YOUR Firebase web config (edit this)
- js/app.js             application logic
- firestore.rules       Firestore security rules
- firebase.json         Firebase Hosting settings

Setup
1. Create a Firebase project; enable Email/Password sign-in and Firestore.
2. Paste your web config into js/firebase-config.js.
3. Publish firestore.rules (Firestore > Rules), or run: firebase deploy --only firestore:rules
4. Create the first admin: add a user in Authentication, then add a Firestore document
   users/<that user's UID> with name, email, role "admin", active true.
5. Log in > Settings: add school year, clusters, sections, advisers, electives; set current year and term.
6. Deploy: firebase deploy --only hosting

Rules are untested. Test each role (admin, registrar, custodian, viewer) before real use.
