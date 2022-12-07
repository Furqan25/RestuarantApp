import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.5/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/9.6.5/firebase-firestore.js"; 
import { updateProfile, getAuth, sendEmailVerification, signInAnonymously, signInWithEmailAndPassword, onAuthStateChanged, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.6.5/firebase-auth.js"                 

if(document.readyState == 'loading'){ //if document is loading, listen for event which fires when page is done loading.
    document.addEventListener('DOMContentLoaded', ready); // then fire ready function containing event lsiteners 
} 
else{ //if already loaded by the time it checks, fires ready function containing event lsiteners 
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
    const db = getFirestore(app);       
    const auth = getAuth();      

    let logOut = document.getElementsByClassName('logOut')[0];
    let nameToBeDisplayed = document.getElementsByClassName("displayName")[0];

    onAuthStateChanged(auth, (user) => {    //user is true if signed in.
        if (user) {
            if (user.isAnonymous){
                nameToBeDisplayed.innerText = "Welcome: Guest";
            }
            else if(user.displayName != null){
                nameToBeDisplayed.innerText = ("Welcome: " + user.displayName);
            }
            else{
                nameToBeDisplayed.innerText = "Welcome";
            }
            
        } 
    });

    document.getElementsByClassName("auths")[0].addEventListener("submit",(e) => {
        e.preventDefault();
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            location.reload();
        })
        .catch((error) => {
            alert("Wrong email or password");
        });
    })

    document.getElementsByClassName("signUp")[0].addEventListener("submit", (e) => {
        e.preventDefault();
        const email = document.getElementById("signUpEmail").value;
        const password = document.getElementById("signUpPassword").value;

        createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            sendEmailVerification(auth.currentUser)
            .then((userCredential)=>{
                console.log("well hi there");
                let name = document.getElementById("signUpUsername").value;

                updateProfile(user, {                   //once user is signed in update the displayName of their firebase object 
                    displayName : name
                })
                .then(()=> {
                    //profile hath been updated homie
                    location.reload();
                })
                .catch((error)=>{
                });
        
            });
            
        })
        .catch((error) => {
            const errorCode = error.code;
            alert(errorCode);
        });
    });

    logOut.addEventListener('click', (e)=>{
        auth.signOut().then(()=>{
            console.log("GOOD BYE EVERYBODY, I HAVE GOT TO GOOOOOO");
            location.reload();
        });
    })
    

}
