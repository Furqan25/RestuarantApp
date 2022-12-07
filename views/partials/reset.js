import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.5/firebase-app.js";
import {getAuth, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.6.5/firebase-auth.js"

if(document.readyState == 'loading'){ //if document is loading, listen for event which fires when page is done loading.
    document.addEventListener('DOMContentLoaded', ready); // then fire ready function containing event lsiteners 
} 
else{ //if already loaded by the time it checks fire ready function containing event lsiteners 
    ready();
}

function ready(){
    const firebaseConfig = {
        apiKey: "AIzaSyBjqvsvB4qfKijSbICQI1WRivwDgTDBUAM",
        authDomain: "kfc-user.firebaseapp.com",
        projectId: "kfc-user",
        storageBucket: "kfc-user.appspot.com",
        messagingSenderId: "571347817879",
        appId: "1:571347817879:web:62ce6a211ec0a2e04c60d2"
    };

    const app = initializeApp(firebaseConfig);      
    const auth = getAuth(); 

    const reset = document.getElementsByClassName("resetForm")[0];     //after reset form is submitted, redirecrs to passwordSent confirmation page
    reset.addEventListener("submit", (e) => {
        e.preventDefault();

        const mail = document.getElementById("email").value;
        sendPasswordResetEmail(auth, mail)
        .then(() => {
            window.location.href = 'http://localhost:3000/forgotPasswordSent'
        })
        .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
        });
    });

}