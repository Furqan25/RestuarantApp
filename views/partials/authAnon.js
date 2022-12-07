import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.5/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/9.6.5/firebase-firestore.js"; 
import { updateProfile, getAuth, signInAnonymously, signInWithEmailAndPassword, onAuthStateChanged, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.6.5/firebase-auth.js"                 

if(document.readyState == 'loading'){ //if document is loading, listen for event which fires when page is done loading.
    document.addEventListener('DOMContentLoaded', ready); // then fire ready function containing event lsiteners 
} 
else{ //if already loaded by the time it checks, fires ready function containing event lsiteners 
    ready();
}


function ready(){ //fires once page has loaded
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
    
    let nameToBeDisplayed = document.getElementsByClassName("displayName")[0];

    window.onload = () => { //when the window loads up 
        onAuthStateChanged(auth, (user) => {    //user is true if signed in display either name or guest if they are a guest.
            if (user) {
                console.log(auth.currentUser)
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
            else{   //if user isn't signed in, show a modal that makes them sign in or continue as guest
                let myModal = new bootstrap.Modal(document.getElementsByClassName('modalStuff')[0]);
                let modal = document.getElementsByClassName('modalStuff');
                myModal.show();
            }
            
        })
        
    }
    document.getElementsByClassName("continueGuest")[0].addEventListener("submit",async (e) => {
        try{
            e.preventDefault();
            const userCredential = await signInAnonymously(auth);
            const user = userCredential.user;
            let firstName = document.getElementById("firstName").value;     //once user is signed in update the displayName of their firebase object 
            let lastName = document.getElementById("lastName").value;

            let name = firstName + ' ' + lastName;
            console.log(name);

            await updateProfile(user, {
                displayName : name
            })
            location.reload();
        }
        catch(error){
            const errorCode = error.code;
            const errorMessage = error.message;
            // ...
        }
    })

    document.getElementsByClassName("signIn")[0].addEventListener("submit",async (e) => {
        try {
            e.preventDefault();
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;

            await signInWithEmailAndPassword(auth, email, password);
            location.reload();          //user signs in and page relaods
        }
        catch(error){
            alert("Wrong email or password");
        }
    });

    let addToCartForm = document.getElementsByClassName("addToCartForm");
    for(let i=0;i<addToCartForm.length;i++){
        addToCartForm[i].addEventListener('submit',async (e)=>{ //when your order is submitted from menu to cart
            try{
                e.preventDefault();
                let cartCount = document.getElementsByClassName("fa-shopping-cart");
                let mixedString = e.target.elements.itemName.value; //get values assigned to itemName radio
                let [style,iName,iPrice] = mixedString.split('-'); //this is done because the value of the itemName radio has style,name and price all assigned to it
                let qty =  e.target.getElementsByClassName('qty')[0].innerText; //get qty of element you cliucked on
                
                let flavor = '';
                if(e.target.getElementsByClassName('flavor')[0]){               //if there is a flavor find it and gets its value
                    flavor = e.target.getElementsByClassName('flavor')[0].value;
                }

                let d = e.target.getElementsByClassName('checks'); //finds checks for toppigns
                let topping = [];                                 //array of toppings because there can be more than one topping assigned to a menu item
                if(d.length>0){                         //if there are toppings for the item
                    for(let i=0;i<d.length;i++){
                        if(d[i].checked){               //if there are topping selected
                            topping.push(d[i].value);   //push into topping array (this will be later sent to backend)
                        }
                    }
                }

                let f = null;
                if(e.target.getElementsByClassName('comboDrinkSelect')[0]){ //if there is a flavor find it and gets its value
                    f = e.target.getElementsByClassName('comboDrinkSelect')[0].value;
                }

                let g = null;
                if(e.target.getElementsByClassName('comboSidesSelect')[0]){ //if there is a flavor find it and gets its value
                    g = e.target.getElementsByClassName('comboSidesSelect')[0].value;
                    console.log(g);
                }

                let h = e.target.getElementsByClassName('sauce'); //finds checks for toppigns
                let sauce = [];                                 //array of toppings because there can be more than one topping assigned to a menu item
                if(h.length>0){                         //if there are toppings for the item
                    for(let i=0;i<h.length;i++){
                        if(h[i].checked){               //if there are topping selected
                            sauce.push(h[i].value);   //push into topping array
                        }
                    }
                }

                let newItem =  {    //assings all the values we jsut found (qty, flavor etc.) to a object
                        'itemName': iName,
                        'Style':style,
                        'itemPrice': iPrice,
                        'qty': qty,
                        'Flavor': flavor,
                        'Toppings': topping,
                        'comboDrink': f,
                        'comboSide': g,
                        'sauce': sauce
                };

                const user = await auth.currentUser.getIdToken(/* forceRefresh */ true);

                let outgoingData = {           //add newItem obj to outgoibngData obj incase there is a need to send more
                    'newItem' : newItem        //info to the backend in the future it can be added to this obj
                };

                const res = await fetch('https://697a-2607-fb90-fed0-f52d-9d45-b5ee-bc64-a90b.ngrok.io/menu',{
                    method: 'POST',
                    headers:{
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${user}`
                    },
                    body: JSON.stringify(outgoingData)
                });

                if(res.status!=200){
                    const isJson = res.headers.get('content-type').includes('application/json');
                    if(isJson){
                        const data = await res.json();
                        throw(data);
                    }
                    throw (`There was an error processing your request`);
                }
                
                const data = await res.json();
                location.reload()  //force referesh AFTER data is sent to backend
            }
            catch(err){
                console.log(err);
            }
            
        });//addToCartForm('submit') event ends
            
    }//for loop ends
}