if(document.readyState == 'loading'){ //if document is loading, listen for event which fires when page is done loading.
    document.addEventListener('DOMContentLoaded', ready); // then fire ready function containing event lsiteners 
} 
else{ //if already loaded by the time it checks fire ready function containing event lsiteners 
    ready();
}

function ready () {
    let minus = document.getElementsByClassName('minus'); //finds all minus buttons
    let add = document.getElementsByClassName('add');     //finds all add buttons
    let modalPrice = document.getElementsByClassName('menuItemsPrice'); //finds all prices that are displayed on cards *NOT MODAL*
    let modalPriceFoot = document.getElementsByClassName('modalPrice'); //finds all prices that are displayed on modal 
    let modalRadioSelection = document.getElementsByClassName('modalRadioSelection'); //finds all radios inside modals
    let mbT = document.getElementsByClassName('fish');  //finds label underneath the radio inside the modal
    let comboSideOption = document.getElementsByClassName('comboSidesSelect');

    //fires the change event when the label underneath the radio inside the modal is clicked
    for(let i=0;i<mbT.length;i++){
        mbT[i].addEventListener('click',(event)=>{
             let a = event.target;
             let b = a.parentElement;
             let c = b.getElementsByClassName('modalRadioSelection')[0];
             c.checked = true;
             c.dispatchEvent(new Event('change'));
         })
     }

    for(let i=0;i<comboSideOption.length;i++){
        comboSideOption[i].addEventListener('change', (event)=>{
            let a = event.target;                                                                      
            let b = a.closest(".addToCartForm"); //finds the parent form of the specific radio you selected 
            let c = comboSideOption[i].options[comboSideOption[i].selectedIndex].value;
            let itemsPrice = b.getElementsByClassName('menuItemsPrice'); 
            let price = b.getElementsByClassName('modalPrice')[0];
            let itemQty = b.getElementsByClassName('qty')[0];

            if(c && c != "French Fries"){
                // console.log ( Number(price.innerText) +  Number(itemQty.innerText));
                //console.log(  Number  (itemQty.innerText * itemsPrice[1].innerText) + Number((itemQty.innerText)  )   );
                let totalPlusQty =  Number(price.innerText) +  Number(itemQty.innerText);
                let totalDoubleCheck = Number((itemQty.innerText * itemsPrice[1].innerText).toFixed(2)); //toFixed returns string and rounds up to closest number after 2nd decimal point. NUmber turns back into number

                if( totalDoubleCheck + Number((itemQty.innerText)  ) ==  totalPlusQty){
                    price.innerText =  totalPlusQty.toFixed(2);
                }

            }
            else{
                price.innerText = Number  (itemQty.innerText * itemsPrice[1].innerText).toFixed(2);
            }    
                                                               
        })
    }
    
//let check = document.getElementsByClassName('');
    //when radio selection inside modal changes change qty to 1 and update the price inside the modal to selected value
    for(let i=0;i<modalRadioSelection.length;i++){
        modalRadioSelection[i].addEventListener('change',(event)=>{
            let a = event.target;                                                                      
            let b = a.closest(".addToCartForm"); //finds the parent form of the specific radio you selected  
            let c = b.getElementsByClassName('modalPrice');  //(all buttons radios and prices inside modal are contained inside a form specific to a modal)
            let d = b.getElementsByClassName('qty');            
            c[0].innerText = modalPrice[i].innerText; //update the price inside the modal to selected value
            d[0].innerText = 1; 
            let checkLength = b.children[0].getElementsByClassName('modalRadioSelection').length;
            
            if(checkLength > 1){ //if this is not done an error message will be given to items with just one option (desserts specifically)
                let check = b.children[0].getElementsByClassName('modalRadioSelection')[1];
                let comboDrinks = b.getElementsByClassName('comboDrinkSelect');
                let z = b.getElementsByClassName('checks');
                let comboSides = b.getElementsByClassName('comboSidesSelect');

                if (check.checked){ //checks if w/topping is checked. if it is true
                        for(let i=0;i<z.length;i++){
                            z[i].disabled = false; //turn off the disable on the checks
                        }
                        if(comboDrinks.length>0){
                            comboDrinks[0].disabled = false;
                        }
                        if(comboSides.length>0){
                            comboSides[0].disabled = false;
                        }
                }
                else if(check.checked == false){ //if it is false
                    for(let i=0;i<z.length;i++){
                        z[i].disabled=true; //disable checks
                        z[i].checked=false;//uncheck checks
                    }
                    if(comboDrinks.length>0){
                        comboDrinks[0].disabled = true;
                        comboDrinks[0].selectedIndex = "0";
                    }
                    if(comboSides.length>0){
                        comboSides[0].disabled = true;
                        comboSides[0].selectedIndex = "0";
                    }
                }  

            }
               
        })
    
    }

    //when minus button inside modal is clicked, qty-1 for each click and update price accordingly
    for(let i=0;i<minus.length;i++){
        minus[i].addEventListener('click',(event)=>{
            let minusClicked = event.target;
            let a = minusClicked.parentElement.children[2];
            let modal = minusClicked.closest(".addToCartForm"); 

            if(a.innerText > 1){
                let modal = minusClicked.parentElement.parentElement; 
                let itemsPrice = modal.getElementsByClassName('menuItemsPrice');
                let rad = modal.getElementsByClassName('form-check-input');
                let comboSide = modal.getElementsByClassName('comboSidesSelect');

                for(let j=0;j<itemsPrice.length;j++){
                    if(rad[j].checked){
                        a.innerText--;
                        modalPriceFoot[i].innerText = ( Number(itemsPrice[j].innerText) * Number(a.innerText) ).toFixed(2);

                        if(comboSide && comboSide.length > 0){
                            let c = comboSide[0].options[comboSide[0].selectedIndex].value;
                            if(c && c != "French Fries"){
                                modalPriceFoot[i].innerText = ( Number(itemsPrice[j].innerText) * Number(a.innerText) + Number(a.innerText) ).toFixed(2);
                            }
                        }  
                          
                    }
                }
                
            }

        })
    }

    //when plus button inside modal is clicked, qty+1 for each click and update price accordingly
    for(let i=0;i<add.length;i++){
        add[i].addEventListener('click',(event)=>{
            let addClicked = event.target;
            let b = addClicked.parentElement.children[2]; //go to parent (footer div which encompasses +,-,qty,price inside modal. from there go to qty. specific to each modal, depending on the modal)

            if(b.innerText < 10){ //sets max qty to 10. nothing gets updated if qty at 10
                let modal = addClicked.closest(".addToCartForm"); 
                let itemsPrice = modal.getElementsByClassName('menuItemsPrice');
                let rad = modal.getElementsByClassName('form-check-input');
                let comboSide = modal.getElementsByClassName('comboSidesSelect');

                /*check if radio is checked, if checked use that price.
                if nothing is checked, do nothing*/ 
                for(let j=0;j<itemsPrice.length;j++){
                    if(rad[j].checked){
                        b.innerText++;
                        modalPriceFoot[i].innerText = ( Number(itemsPrice[j].innerText) * Number(b.innerText) ).toFixed(2);

                        if(comboSide && comboSide.length > 0){
                            comboSide[0].dispatchEvent(new Event('change'));
                        }
                        
                    }
                }

            }

        })
    }


}
