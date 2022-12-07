import { onAuthStateChanged, getAuth } from "https://www.gstatic.com/firebasejs/9.6.5/firebase-auth.js"                 
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.5/firebase-app.js";

window.onload = () => {
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
    const stripe = Stripe("pk_test_51KnSx5HvfNBcrjk021sl5Px9UmEbUW8M4XT2dLpI7lBDYYw2dkGv20EDUXZBcux6g6vg6nCAEbRPZZpcvFWMrfdL00QQzWrQFQ")
    let elements;

    onAuthStateChanged(auth, (user) => {    //user is true if signed in.
        if (user) {
            auth.currentUser.getIdToken(/* forceRefresh */ true).then(function(user) {

                fetch('https://697a-2607-fb90-fed0-f52d-9d45-b5ee-bc64-a90b.ngrok.io/order',{
                    method: 'GET',
                    headers:{
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${user}`
                    },
                })
                .then(res => res.json())
                .then(res =>  {
                    let result = res.menuItemFromDB;
                    let checkoutItems = document.getElementsByClassName('checkoutItems')[0];
                    checkoutItems.previousSibling.remove()

                    if(result && result.length>0){
                        let docFrag = document.createDocumentFragment();
                        let paymentForm = document.getElementById('payment-form');
                        paymentForm.classList.remove("hidden");
                        document.querySelector("#payment-form").addEventListener("submit", handleSubmit);
                        initialize(res.cs);
                        checkStatus();
                        let total = document.createElement('h6');
                        total.textContent = `Total: ${res.total}`;
                        total.setAttribute('class','totalPrice')
                        docFrag.appendChild(total);

                        for(let i=0;i<result.length;i++){
                    
                            let divItem = document.createElement('div');
                            docFrag.appendChild(divItem);
                            divItem.setAttribute('class','checkoutDiv')
                    
                            let itemNum = document.createElement('h6');
                            itemNum.textContent = `${i+1}: `;
                            itemNum.setAttribute('class','itemNum')
                            divItem.appendChild(itemNum);
    
                            let divDesc = document.createElement('h3');
                            divDesc.textContent = `Name: ${result[i].itemName}`;
                            divDesc.setAttribute('class','checkoutName')
                            divItem.appendChild(divDesc);
                    
                            let divPrice = document.createElement('h3');
                            divPrice.textContent = `Price: $${(result[i].itemPrice*result[i].qty).toFixed(2)} ($${(result[i].itemPrice)} each)`;
                            divPrice.setAttribute('class','checkoutPrice')
                            divItem.appendChild(divPrice);
                    
                            let divQty = document.createElement('h3');
                            divQty.textContent = `Qty: ${result[i].qty}`;
                            divQty.setAttribute('class','checkoutQty')
                            divItem.appendChild(divQty);
                    
                            let divItemType = document.createElement('h3');
                            divItemType .textContent = `Style: ${result[i].Style}`;
                            divItemType .setAttribute('class','itemType')
                            if(result[i].Style != result[i].itemName ){
                                divItem.appendChild(divItemType);
                            }
                            
                            if(result[i].Flavor){
                                let divFlavor = document.createElement('h3');
                                divFlavor.textContent = `Flavor: ${result[i].Flavor}`;
                                divFlavor.setAttribute('class','checkoutFlav')
                                divItem.appendChild(divFlavor);
                            }
                    
                            if(result[i].Toppings.length >0){
                                let divToppings = document.createElement('h3');
                                divToppings.textContent = `Toppings: ${result[i].Toppings.join(', ')}`;
                                divToppings.setAttribute('class','checkoutTopp')
                                divItem.appendChild(divToppings);
                            }
                            
                            if(result[i].comboDrink && result[i].comboDrink.length >0){
                                let divToppings = document.createElement('h3');
                                divToppings.textContent = `Combo Drink: ${result[i].comboDrink}`;
                                divToppings.setAttribute('class','checkoutComboDrink')
                                divItem.appendChild(divToppings);
                            }
                    
                            if(result[i].comboSide && result[i].comboSide.length >0){
                                let divToppings = document.createElement('h3');
                                divToppings.textContent = `Combo Side: ${result[i].comboSide}`;
                                divToppings.setAttribute('class','checkoutComboSide')
                                divItem.appendChild(divToppings);
                            }
    
                            if(result[i].sauce && result[i].sauce.length >0){
                                let divToppings = document.createElement('h3');
                                divToppings.textContent = `Sauce: ${result[i].sauce.join(', ')}`;
                                divToppings.setAttribute('class','checkoutsauce')
                                divItem.appendChild(divToppings);
                            }
                    
                            let btn = document.createElement('button');
                            btn.setAttribute('class','xBtn');
                            btn.setAttribute('data-itemNum',`${i}`);
                            btn.innerText = "Delete";
                    
                            divItem.appendChild(btn);
    
                            let br = document.createElement('br');
                            let brd = document.createElement('br');
                            divItem.appendChild(br);
                            divItem.appendChild(brd);
                                            
                            checkoutItems.appendChild(docFrag);
                        }
    
                        let btn = document.getElementsByClassName('xBtn');
    
                        for(let i =0; i<btn.length;i++){
                            btn[i].addEventListener('click',(e)=>{
                                let itemNum = e.target.dataset.itemnum;
                                let dingus = {
                                    num:itemNum
                                }
    
                                fetch('https://697a-2607-fb90-fed0-f52d-9d45-b5ee-bc64-a90b.ngrok.io/checkout',{
                                    method: 'DELETE',
                                    headers:{
                                        'Accept': 'application/json',
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${user}`
                                    },
                                    body: JSON.stringify(dingus)
                                    
                                })
                                .then(res => res.json())
                                .then(res =>  {
                                    location.reload();
                                })
                            })
                        }

                    }
                    else{
                        let checkoutItems = document.getElementsByClassName('checkoutItems')[0];

                        let docFrag = document.createDocumentFragment();
                        let divItem = document.createElement('h1');
                        divItem.textContent = "CART EMPTY" ;
                        docFrag.appendChild(divItem);

                        divItem.setAttribute('class','checkoutDiv')

                        checkoutItems.appendChild(docFrag);
                    }
 
                })//fetch(get).then().then()
                .catch((error) => {
                    console.log(error);
                });

            })//auth.currentUser.getIdToken()
            .catch(function(error) {
                console.log(error)
            });
            
        }
        else { //(if no user) 
            let checkoutItems = document.getElementsByClassName('checkoutItems')[0];
            let container = document.getElementsByClassName('container')[0];

            if(checkoutItems.hasChildNodes()){
                while(checkoutItems.firstChild){
                    checkoutItems.removeChild(checkoutItems.lastChild);
                }
                location.reload();
            }
            
            let docFrag = document.createDocumentFragment();
            let divItem = document.createElement('h1');
            divItem.textContent = "CART EMPTY" ;
            docFrag.appendChild(divItem);

            divItem.setAttribute('class','checkoutDiv')

            container.insertBefore(docFrag,checkoutItems);
            
        }

    })//onAuthStateChanged

    async function initialize(cs) {
        const payNowButton = document.getElementById('submit');
        const  clientSecret  = cs;
      
        const appearance = {
            theme: 'flat',
            labels: 'floating',
            variables: {
              fontWeightNormal: '500',
              borderRadius: '2px',
              colorBackground: 'white',
              colorPrimary: '#FF5349',
              colorPrimaryText: 'white',
              spacingGridRow: '15px'
            },
            rules: {
              '.Label': {
                marginBottom: '6px'
              },
              '.Tab, .Input, .Block': {
                boxShadow: '0px 3px 10px rgba(18, 42, 66, 0.08)',
                padding: '12px'
              }
            }
        };
        elements = stripe.elements({clientSecret,appearance });
        payNowButton.classList.remove("d-none");
        const paymentElement = elements.create("payment");
        paymentElement.mount("#payment-element");

        let emailBox = document.getElementById("email");
        auth.currentUser.email ? emailBox.value = auth.currentUser.email : null;

    }
    
    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        let email = document.getElementById("email").value;
        let name = auth.currentUser.displayName;

        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                // Make sure to change this to your payment completion page
                return_url: "http://localhost:3000/orderConfirmation",
                receipt_email: email,
                payment_method_data: {
                    billing_details: {
                        email: email,
                        name: name
                    }
                }
            }
        });
        if (error.type === "card_error" || error.type === "validation_error") {
            showMessage(error);
        } 
        else {
            showMessage({
                message: "An unexpected error occured."
            });
        }
        setLoading(false);
    }


    async function checkStatus() {
        const clientSecret = new URLSearchParams(window.location.search).get(
          "payment_intent_client_secret"
        );
      
        if (!clientSecret) {
          return;
        }
      
        const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
      
        switch (paymentIntent.status) {
          case "succeeded":
            showMessage("Payment succeeded!");
            break;
          case "processing":
            showMessage("Your payment is processing.");
            break;
          case "requires_payment_method":
            showMessage("Your payment was not successful, please try again.");
            break;
          default:
            showMessage("Something went wrong.");
            break;
        }
    }
    
    function showMessage(error) {
        const messageContainer = document.querySelector("#payment-message");
        if(error.payment_intent && error.payment_intent.receipt_email === null){
            messageContainer.classList.remove("hidden");
            messageContainer.textContent = "Please enter an email";
            alert("Please enter an email");
        
            setTimeout(function () {
            messageContainer.classList.add("hidden");
            messageContainer.textContent = "";
            }, 4000);
        }
        else{
            messageContainer.classList.remove("hidden");
            messageContainer.textContent = error.message;
            alert(error.message);
          
            setTimeout(function () {
              messageContainer.classList.add("hidden");
              messageContainer.textContent = "";
            }, 4000);
        }
    }

    function setLoading(isLoading) {
        if (isLoading) {
          // Disable the button and show a spinner
          document.querySelector("#submit").disabled = true;
          document.querySelector("#spinner").classList.remove("hidden");
          document.querySelector("#button-text").classList.add("hidden");
        } else {
          document.querySelector("#submit").disabled = false;
          document.querySelector("#spinner").classList.add("hidden");
          document.querySelector("#button-text").classList.remove("hidden");
        }
    }

}