export function convertNumberToWords(amount) {
    let number = parseFloat(amount);
    if (isNaN(number) || number < 0) return "";
    
    let whole = Math.floor(number);
    let paise = Math.round((number - whole) * 100);
    
    function helper(n) {
        let units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
                     "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
        let tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
        
        if (n < 20) return units[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + units[n % 10] : "");
        if (n < 1000) return units[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " and " + helper(n % 100) : "");
        if (n < 100000) return helper(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + helper(n % 1000) : "");
        if (n < 10000000) return helper(Math.floor(n / 100000)) + " Lakh" + (n % 100000 !== 0 ? " " + helper(n % 100000) : "");
        return helper(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 !== 0 ? " " + helper(n % 10000000) : "");
    }
    
    let rupeesStr = helper(whole);
    if (!rupeesStr || rupeesStr.trim() === "") rupeesStr = "Zero";
    
    let paiseStr = "";
    if (paise > 0) {
        paiseStr = " and " + helper(paise) + " Paise";
    }
    return rupeesStr + " Rupees" + paiseStr + " Only";
}
