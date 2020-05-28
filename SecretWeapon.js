// Classes
class PayinFee {
  constructor(percentage, transaction, min) {
    this.percentage = percentage != "" ? percentage : 'NULL';
    this.transaction = transaction != "" ? transaction : 0.00;
    this.min = min != "" ? min : 0.00;
    this.hasValue = percentage != "" || transaction != "" || min != "";
  }
}

class PayinConfiguration {
  constructor(cardsPM, bankPM, cashPM, walletPM = null) {
    this.cardsPaymentMethods = cardsPM;
    this.bankPaymentMethods = bankPM;
    this.cashPaymentMethods = cashPM;
    this.walletPaymentMethods = walletPM;
  }
}

class PayoutConfiguration {
  constructor(taxes) {
    this.taxes = taxes;
  }
}

class PayoutTax {
  constructor(payoutTaxId, payoutTaxName) {
    this.payoutTaxId = payoutTaxId;
    this.payoutTaxName = payoutTaxName;
  }
}

class Country {
  constructor(iso, fullName, id, currency, vat, payinConfiguration, payoutConfiguration = null) {
    this.isoCode = iso;
    this.fullName = fullName;
    this.id = id;
    this.currency = currency;
    this.vat = vat;
    this.payinConfiguration = payinConfiguration;
    this.payoutConfiguration = payoutConfiguration;
  }

  getPayinFeeInserts(mid, cardPayinFee, bankPayinFee, cashPayinFee, walletPayinFee, includeVAT) {
    var inserts = "";

    /* cardFee = includeVAT == true ? cardFee * (1 + this.vat) : cardFee; */

    inserts += this.getPayinFeeInsertsFor("CARDS", mid, cardPayinFee, this.payinConfiguration.cardsPaymentMethods);
    inserts += this.getPayinFeeInsertsFor("BANK_TRANSFERS", mid, bankPayinFee, this.payinConfiguration.bankPaymentMethods);
    inserts += this.getPayinFeeInsertsFor("CASH", mid, cashPayinFee, this.payinConfiguration.cashPaymentMethods);
    inserts += this.getPayinFeeInsertsFor("WALLET", mid, walletPayinFee, this.payinConfiguration.walletPaymentMethods);

    if (inserts == '') {
      inserts = 'No inserts for the current country. Please fill at least one payment method fee value \n';
    } else {
      inserts = beautifyContent(this.fullName, inserts);
    }

    return inserts;
  }
  getPayinFeeInsertsFor(method, mid, payinFee, paymentMethodsAvailable) {
    var inserts = "";

    if (paymentMethodsAvailable != null && payinFee.hasValue) {
      inserts += "-- " + this.isoCode + " " + method + " \n";
      for (var i = 0; i < paymentMethodsAvailable.length; i++) {
        inserts += insertPayinFeeTemplate
          .replace(/%mid/g, mid)
          .replace(/%countryId/g, this.id)
          .replace(/%paymentMethod/g, "'" + paymentMethodsAvailable[i] + "'")
          .replace(/%feePercentage/g, payinFee.percentage)
          .replace(/%feeTransaction/g, payinFee.transaction)
          .replace(/%feeMin/g, payinFee.min);
      }
    }

    return inserts;
  }

  getFXInsertsFor(mid, columns, fees) {
    return '-- FX for ' + this.fullName + " \n" +
      insertFxTemplate
      .replace(/%columns/g, columns)
      .replace(/%mid/g, mid)
      .replace(/%iso/g, "'" + this.currency + "'")
      .replace(/%fees/g, fees);
  }

  getPayoutFeeInsert(mid, processingFeePercent, processingFeeAmount, rejectionFeeAmount, responsible, merchantFeePercent, minimumFeeAmount, minimumAmount) {
    if (this.payoutConfiguration != null) {

      return '-- Fee for ' + this.fullName + " \n" +
        insertPayoutFeeTemplate
        .replace(/%mid/g, mid)
        .replace(/%countryId/g, this.id)
        .replace(/%processingFeePercent/g, processingFeePercent)
        .replace(/%processingFeeAmount/g, processingFeeAmount)
        .replace(/%rejectionFeeAmount/g, rejectionFeeAmount)
        .replace(/%processingResponsible/g, responsible)
        .replace(/%merchantFeePercent/g, merchantFeePercent)
        .replace(/%minimumFeeAmount/g, minimumFeeAmount)
        .replace(/%minimumAmount/g, minimumAmount);
    }
  }
  getPayoutTaxInsert(mid, responsible) {
    if (this.payoutConfiguration != null && this.payoutConfiguration.taxes != null) {
      var taxes = "";

      for (var i = 0; i < this.payoutConfiguration.taxes.length; i++) {
        taxes +=
          '-- ' + this.fullName + " " + this.payoutConfiguration.taxes[i].payoutTaxName + " \n" +
          insertPayoutTaxTemplate
          .replace(/%mid/g, mid)
          .replace(/%payoutTaxId/g, this.payoutConfiguration.taxes[i].payoutTaxId)
          .replace(/%responsible/g, responsible);
      }

      return taxes;
    }
  }
}

// Templates
var jiraBeautifyTemplate = "*%title* \n {code:sql} \n %content {code} \n";

var insertPayinFeeTemplate = "INSERT INTO unipay.merchants_fee(id_merchant, id_country, payment_code, fee_percent, fee_transaction, fee_min, application_date) VALUES (%mid, %countryId, %paymentMethod, %feePercentage, %feeTransaction, %feeMin, NOW());\n";

var insertFxTemplate = "INSERT INTO unipay.cotizacion_merchant(id_merchant, fecha, moneda %columns) VALUES (%mid, NOW(), %iso %fees);\n";

var insertPayoutTaxTemplate = "INSERT INTO unipay.payout_merchant_tax(id_merchant, id_payout_tax, processing_responsible, application_date, enabled) VALUES (%mid, %payoutTaxId, '%responsible', now(), 1); \n";

var insertPayoutFeeTemplate = "insert into unipay.cashout_merchant_fee(id_cashout_merchant_fee, id_merchant, id_country, processing_fee_percent, processing_fee_amount, rejection_fee_amount, processing_responsible, merchant_fee_percent, minimun_fee_amount, minimun_amount, financial_trans_tax, application_date, enabled) VALUES (NULL, %mid, %countryId, %processingFeePercent, %processingFeeAmount, %rejectionFeeAmount,%processingResponsible,%merchantFeePercent,%minimumFeeAmount,%minimumAmount,0.0,now(),1); \n";


// Global Properties
const apiClientId = {
  FULLAPI: '1',
  STREAMLINECASH: '4',
  STREAMLINECARDS: '6'
}
const countriesList = {
  AR: new Country("AR", "Argentina", 11, "ARS", 0.21, new PayinConfiguration(["VI", "MC", "AE", "DC", "CM", "NJ", "TS", "NT", "CS", "CL", "AG", "VD", "MD", "MS", "CO", "CB"], ["SI"], ["PF", "RP"]), new PayoutConfiguration([new PayoutTax(2, 'ID'), new PayoutTax(3, 'IC')])),
  BO: new Country("BO", "Bolivia", 28, "BOB", 0.13, new PayinConfiguration(null, ["IO"], null)),
  BR: new Country("BR", "Brazil", 29, "BRL", 0.02, new PayinConfiguration(["VI", "VD", "MC", "MD", "EL", "HI", "AE", "JC", "AU", "DI"], ["I", "B", "BB", "CA", "SB"], ["BL"]), new PayoutConfiguration([new PayoutTax(1, 'IOF')])),
  CL: new Country("CL", "Chile", 44, "CLP", 0.19, new PayinConfiguration(["MC", "VI", "DC", "AE", "PR", "CM", "MG", "MH"], ["WP"], ["SP"])),
  CN: new Country("CN", "China", 46, "CNY", 0, new PayinConfiguration(null, ["EF", "UP"], null)),
  CO: new Country("CO", "Colombia", 47, "COP", 0.19, new PayinConfiguration(["VI", "MC", "VD", "MD", "AE", "DC"], ["PC"], ["EY", "DA", "BU"]), new PayoutConfiguration([new PayoutTax(4, 'GMF')])),
  EC: new Country("EC", "Ecuador", 61, "USD", 0.12, new PayinConfiguration(["VI", "MC"], null, ["EF"])),
  EG: new Country("EG", "Egypt", 63, "EGP", 0.14, new PayinConfiguration(["VI", "MC"], null, ["FW"])),
  IN: new Country("IN", "India", 101, "INR", 0.18, new PayinConfiguration(["VI", "VD", "MC", "MD", "AE", "RU"], ["NB", "UI"], null, ["PW"])),
  ID: new Country("ID", "Indonesia", 98, "IDR", 0.1, new PayinConfiguration(["VI", "MC", "JC", "AE"], ["VS"], ["RO"], ["XW"])),
  MA: new Country("MA", "Morocco", 132, "MAD", 0.2, new PayinConfiguration(["MI", "VI", "MC"], null, ["AM", "PP"])),
  MX: new Country("MX", "Mexico", 150, "MXN", 0.16, new PayinConfiguration(["VI", "MC", "VD", "MD", "AE", "KC", "KD"], ["SE", "BV", "BQ", "SM"], ["OX"])),
  NG: new Country("NG", "Nigeria", 157, "NGN", 0, new PayinConfiguration(["VI", "MC", "VD", "MD", "VE"], null, null)),
  PE: new Country("PE", "Peru", 167, "PEN", 0.18, new PayinConfiguration(["VI", "MC", "AE", "DC", "VD"], ["BC", "IB", "BP"], ["EF"]), new PayoutConfiguration([new PayoutTax(101, 'ITF')])),
  PY: new Country("PY", "Paraguay", 179, "PYG", 0.1, new PayinConfiguration(["VI", "MC", "AE", "DC", "JC", "DI", "VD", "MS"], null, ["PE"])),
  TR: new Country("TR", "Turkey", 215, "TRY", 0.18, new PayinConfiguration(["AE", "VI", "MC", "OT"], null, null)),
  UY: new Country("UY", "Uruguay", 224, "UYU", 0.22, new PayinConfiguration(["VI", "MC", "DC", "OA", "LI"], null, ["RE", "AI"])),
  ZA: new Country("ZA", "South Africa", 237, "ZAR", 0, new PayinConfiguration(["VI", "MC"], ["IO"], null))
}

// Smart Buttons Functions
function openTab(evt, tabName) {
  // Declare all variables
  var i, tabcontent, tablinks;

  // Get all elements with class="tabcontent" and hide them
  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }

  // Get all elements with class="tablinks" and remove the class "active"
  tablinks = document.getElementsByClassName("tablinks");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }

  // Show the current tab, and add an "active" class to the button that opened the tab
  document.getElementById(tabName).style.display = "block";
  evt.currentTarget.className += " active";

  if (tabName == 'PayinFees') updateAvailableFees();
}

function clearInputs() {
  var inputs = document.querySelectorAll("input[type=text]")
  for (var i = 0; i < inputs.length; i++) inputs[i].value = "";
}

function clearContent() {
  document.getElementById("content").innerText = "";
}

function copyContentToClipboard() {
  const el = document.createElement('textarea');
  el.value = document.getElementById("content").innerText;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);

  tempAlert('Copied to clipboard', 1000);
}

function addFormatForJira() {

  var title = document.getElementsByClassName('tablinks active')[0].textContent;
  var content = document.getElementById("content").innerText;

  document.getElementById("content").innerText = beautifyContent(title, content)
}

// Helper functions
function beautifyContent(title, content) {
  return jiraBeautifyTemplate
    .replace(/%title/g, title)
    .replace(/%content/g, content);
}

function tempAlert(msg, duration) {
  var el = document.createElement("div");
  el.setAttribute("style", "position:absolute;top:50%;left:50%;background-color:gray;color:white");
  el.innerHTML = msg;
  setTimeout(function() {
    el.parentNode.removeChild(el);
  }, duration);
  document.body.appendChild(el);
}

function getSelectSelectedValue(id) {
  var e = document.getElementById(id);
  return e.options[e.selectedIndex].value;
}

function boldText(content) {
  return boldTextTemplate.replace(/%content/g, text);
}

// FX
function createFXInserts() {
  var fees = "";
  var columns = "";

  var mid = document.getElementById("fxMid").value;
  var payinFX = document.getElementById("payinFX").value;
  var payoutFX = document.getElementById("payoutFX").value;

  if (payinFX != "") columns += ", xr_in";
  if (payoutFX != "") columns += ", xr_out";
  if (payinFX != "") fees += ", '" + payinFX + "%'";
  if (payoutFX != "") fees += ", '" + payoutFX + "%'";

  document.getElementById("content").innerText += findSelectedCountryInSelectWithId("countriesFXSelect").getFXInsertsFor(mid, columns, fees);
}

// MercadoPago Inserts Functions

var mercadoPagoCredentialTemplate = "INSERT INTO pm.mercadopago_credential (client_id, client_secret,public_key,access_token,country,panel_email,type,description,creation_date,category,binary_account,sponsor_id) VALUES('%clientId','%clientSecret','%publicKey','%accessToken','%country','%mail','preapproval','%name mercadopago %country',NOW(),'%category', '%binaryAccount','%sponsorId');\n";
var mercadoPagoSubclientCredential = "INSERT INTO pm.mercadopago_subclient_credential SELECT %apiId, %mid,id_mercadopago_credential,1 FROM pm.mercadopago_credential WHERE client_id = '%clientId' AND country = '%country' AND sponsor_id = '%sponsorId';\n"

var mercadoPagoGMCashTemplate = '{\n"country":"%country",\n"operation":"ALL",\n"cvv_type":"ALL",\n"merchant_id":%mid,\n"description":"Mercadopago %country - %name",\n"gateway_id":%gateway,\n"active":true,\n"credential_data":{\n"access_token":"%accessToken",\n"sponsor_id":"%sponsorId"\n},\n"generic":false\n}';
var mercadoPagoGMCardTemplate = '{\n"country":"%country",\n"operation":"ALL",\n"cvv_type":"ALL",\n"merchant_id":%mid,\n"description":"Mercadopago %country - %name",\n"gateway_id":%gateway,\n"active":true,\n"credential_data":{\n"public_key":"%publicKey"\n"access_token":"%accessToken",\n"binary_account":true,\n"sponsor_id":"%sponsorId",\n"category_id":"%category",\n},\n"generic":false\n}';

function createMercadoPagoInserts() {
  var inserts = "";
  var mid = document.getElementById("mpMid").value;
  var name = document.getElementById("name").value;
  var mail = document.getElementById("mail").value;
  var clientId = document.getElementById("clientId").value;
  var clientSecret = document.getElementById("clientSecret").value;
  var publicKey = document.getElementById("publicKey").value;
  var accessToken = document.getElementById("accessToken").value;
  var category = document.getElementById("category").value;

  var country = document.querySelector('input[name="country"]:checked').value;

  switch (country) {
    case 'AR':
      inserts = createMPGMCardInsert(mid, name, publicKey, accessToken, 242832157, category, country, 66)
      break;
    case 'BR':
      inserts = createMPGMCardInsert(mid, name, publicKey, accessToken, 242980896, category, country)
      inserts = createMPGMCashInsert(mid, name, accessToken, 242980896, country);
      break;
    case 'CL':
      inserts = createMPGMCashInsert(mid, name, accessToken, 193468538, country,231);
      break;
    case 'CO':
      inserts = createAPCInserts(mid, name, mail, clientId, clientSecret, publicKey, accessToken, 243357886, category, country);
      break;
    case 'PE':
      inserts = createAPDInserts(mid, name, mail, clientId, clientSecret, publicKey, accessToken, 243048183, category, country);
      break;
    case 'UY':
      inserts = createAPDInserts(mid, name, mail, clientId, clientSecret, publicKey, accessToken, 258033865, category, country);
      inserts += createAPCInserts(mid, name, mail, clientId, clientSecret, publicKey, accessToken, 258033865, category, country);
      break;
  }

  document.getElementById("content").innerText += inserts;
}

/* PM FUNCTIONS */
function createAPDInserts(mid, name, mail, clientId, clientSecret, publicKey, accessToken, sponsorId, category, country) {
  return "-- APD " + country + " \n" +
    getMPCredentialInsert(name, mail, clientId, clientSecret, publicKey, accessToken, sponsorId, category, country, 1) +
    getMpSubclientCredentialInsert(mid, clientId, country, sponsorId, apiClientId.FULLAPI) +
    getMpSubclientCredentialInsert(mid, clientId, country, sponsorId, apiClientId.STREAMLINECARDS);
}
function createAPCInserts(mid, name, mail, clientId, clientSecret, publicKey, accessToken, sponsorId, category, country) {
  return "-- APC " + country + " \n" +
    getMPCredentialInsert(name, mail, clientId, clientSecret, publicKey, accessToken, sponsorId, category, country, 1) +
    getMpSubclientCredentialInsert(mid, clientId, country, sponsorId, apiClientId.STREAMLINECASH);
}
function getMPCredentialInsert(name, mail, clientId, clientSecret, publicKey, accessToken, sponsorId, category, country, binaryAccount) {
  return mercadoPagoCredentialTemplate
    .replace(/%clientId/g, clientId)
    .replace(/%clientSecret/g, clientSecret)
    .replace(/%publicKey/g, publicKey)
    .replace(/%accessToken/g, accessToken)
    .replace(/%country/g, country)
    .replace(/%mail/g, mail)
    .replace(/%name/g, name)
    .replace(/%category/g, category)
    .replace(/%binaryAccount/g, binaryAccount)
    .replace(/%sponsorId/g, sponsorId);
}
function getMpSubclientCredentialInsert(mid, clientId, country, sponsorId, apiId) {
  return mercadoPagoSubclientCredential
    .replace(/%apiId/g, apiId)
    .replace(/%mid/g, mid)
    .replace(/%clientId/g, clientId)
    .replace(/%country/g, country)
    .replace(/%sponsorId/g, sponsorId);
}

/* GM FUNCTIONS */
function createMPGMCashInsert(mid, name, accessToken, sponsorId, country, gatewayId) {
  return "*Insert in GM*" + " \n" +
          getMPGMCashInsert(mid, name, accessToken, sponsorId, country, gatewayId);
}
function createMPGMCardInsert(mid, name, publicKey, accessToken, sponsorId, category, country, gatewayId) {
  return "*Insert in GM*" + " \n" +
          getMPGMCardInsert(mid, name, publicKey, accessToken, sponsorId, category, country, gatewayId);
}
function getMPGMCashInsert(mid, name, accessToken, sponsorId, country, gatewayId) {
  return mercadoPagoGMCashTemplate
          .replace(/%mid/g, mid)
          .replace(/%name/g, name)
          .replace(/%accessToken/g, accessToken)
          .replace(/%country/g, country)
          .replace(/%gateway/g, gatewayId)
          .replace(/%sponsorId/g, sponsorId);
}
function getMPGMCardInsert(mid, name, publicKey, accessToken, sponsorId, category, country, gatewayId) {
  return mercadoPagoGMCardTemplate
          .replace(/%mid/g, mid)
          .replace(/%name/g, name)
          .replace(/%publicKey/g, publicKey)
          .replace(/%accessToken/g, accessToken)
          .replace(/%country/g, country)
          .replace(/%category/g, category)
          .replace(/%gateway/g, gatewayId)
          .replace(/%sponsorId/g, sponsorId);
}

// WhiteListedIps
function getIpRangeFromAddressAndNetmask() {
  // part[0] = base address, part[1] = netmask
  var part = document.getElementById("baseIp").value.split("/");
  var ipaddress = part[0].split('.');
  var netmaskblocks = ["0", "0", "0", "0"];

  if (!/\d+\.\d+\.\d+\.\d+/.test(part[1])) {
    // part[1] has to be between 0 and 32
    netmaskblocks = ("1".repeat(parseInt(part[1], 10)) + "0".repeat(32 - parseInt(part[1], 10))).match(/.{1,8}/g);
    netmaskblocks = netmaskblocks.map(function(el) {
      return parseInt(el, 2);
    });
  } else {
    // xxx.xxx.xxx.xxx
    netmaskblocks = part[1].split('.').map(function(el) {
      return parseInt(el, 10)
    });
  }
  // invert for creating broadcast address (highest address)
  var invertedNetmaskblocks = netmaskblocks.map(function(el) {
    return el ^ 255;
  });
  var baseAddress = ipaddress.map(function(block, idx) {
    return block & netmaskblocks[idx];
  });
  var broadcastaddress = baseAddress.map(function(block, idx) {
    return block | invertedNetmaskblocks[idx];
  });

  document.getElementById("content").innerText += generateInserts(document.getElementById("mid").value, baseAddress, broadcastaddress[3]);

}

function generateInserts(mid, baseAddress, max) {
  var insertQueryStatements = "";
  var min = baseAddress[3];
  var baseIp = baseAddress[0] + "." + baseAddress[1] + "." + baseAddress[2];

  var insertQueryStatement = "INSERT INTO unipay.merchants_ips (idmerchants, ip_address, active) values (" + mid + ", '" + baseIp + ".%s', 'Y');";

  for (var i = min; i <= max; i++) {
    insertQueryStatements += "\n" + insertQueryStatement.replace(/%s/g, i);
  }

  return insertQueryStatements;
}

// Payin Fee Inserts
function createInserts() {
  var mid = document.getElementById("payinMid").value;
  var includeVAT = document.getElementById("payinIncludeVAT").checked;
  var selectedCountry = findSelectedCountryInSelectWithId("countriesSelect");

  var cardPayinFee = new PayinFee(document.getElementById("cardFeePercentage").value, document.getElementById("cardFeeTransaction").value, document.getElementById("cardFeeMin").value);
  var bankayinFee = new PayinFee(document.getElementById("bankFeePercentage").value, document.getElementById("bankFeeTransaction").value, document.getElementById("bankFeeMin").value);
  var cashPayinFee = new PayinFee(document.getElementById("cashFeePercentage").value, document.getElementById("cashFeeTransaction").value, document.getElementById("cashFeeMin").value);
  var walletPayinFee = new PayinFee(document.getElementById("walletFeePercentage").value, document.getElementById("walletFeeTransaction").value, document.getElementById("walletFeeMin").value);

  document.getElementById("content").innerText += selectedCountry.getPayinFeeInserts(mid, cardPayinFee, bankayinFee, cashPayinFee, walletPayinFee, includeVAT);
}

function findSelectedCountryInSelectWithId(id) {
  return countriesList[getSelectSelectedValue(id)];
}

function updateAvailableFees() {
  var selectedCountry = findSelectedCountryInSelectWithId("countriesSelect");

  document.getElementById("payinCardFees").style.display = selectedCountry.payinConfiguration.cardsPaymentMethods != null ? 'inherit' : 'none';
  document.getElementById("payinBankFees").style.display = selectedCountry.payinConfiguration.bankPaymentMethods != null ? 'inherit' : 'none';
  document.getElementById("payinCashFees").style.display = selectedCountry.payinConfiguration.cashPaymentMethods != null ? 'inherit' : 'none';
  document.getElementById("payinWalletFees").style.display = selectedCountry.payinConfiguration.walletPaymentMethods != null ? 'inherit' : 'none';

  getVATValue();
}

function getVATValue() {
  var checkBox = document.getElementById("payinIncludeVAT");
  var selectedCountry = findSelectedCountryInSelectWithId("countriesSelect");
  var text = document.getElementById("vatValue");
  text.innerText = "The VAT for " + selectedCountry.fullName + " is " + selectedCountry.vat * 100 + "%";
  if (checkBox.checked == true) {
    text.style.display = "inherit";
  } else {
    text.style.display = "none";
  }
}

// ******** CREDENTIALS FUNCTIONS ************

function showSelectedCredential() {
  var credentials = document.getElementsByClassName("credentials");
  for (i = 0; i < credentials.length; i++) {
    credentials[i].style.display = "none";
  }

  document.getElementById(getSelectSelectedValue("credentialsSelect")).style.display = "block";
}

// Openpay Inserts
var speiSubclientCredentialTemplate = "insert into pm.spei_subclient_credential(id_api_client,subclient_reference,id_spei_credential,status) values (%apiClientId,'%mid',8,'1');\n"
var openPayGMCredentialsTemplate = '{\n"country": "MX",\n"operation": "ALL",\n"cvv_type": "ALL",\n"merchant_id":%mid,\n"description": "Openpay - %name",\n"active": true,\n   "gateway_id": 78,\n"credential_data": {\n"client_id":"%clientId",\n"private_key": "%privateKey",\n"public_key": "%publicKey"\n}\n}\n';

function createOpenpayInserts() {
  var inserts = "";

  var mid = document.getElementById("opMid").value;
  var name = document.getElementById("opName").value;
  var clientId = document.getElementById("opClientId").value;
  var sk = document.getElementById("opPrivateKey").value;
  var pk = document.getElementById("opPublicKey").value;

  inserts += beautifyContent('Insert in GM', getOpenpayGMCredentialsInserts(mid, name, clientId, sk, pk));
  inserts += beautifyContent('Insert in APC', getOpenpayAPCInserts(mid));

  document.getElementById("content").innerText = inserts;
}

function getOpenpayGMCredentialsInserts(mid, name, clientId, sk, pk) {
  return openPayGMCredentialsTemplate
    .replace(/%mid/g, mid)
    .replace(/%name/g, name)
    .replace(/%clientId/g, clientId)
    .replace(/%privateKey/g, sk)
    .replace(/%publicKey/g, pk);
}

function getOpenpayAPCInserts(mid) {
  return speiSubclientCredentialTemplate
    .replace(/%apiClientId/g, apiClientId.STREAMLINECASH)
    .replace(/%mid/g, mid);
}

// Razorpay
var insertRazorpayCredentialTemplate = "insert into pm.razorpay_credential(client_id,client_secret,public_key,access_token,last_update,country,description,creation_date,is_generic) values('%name','%keyId','%keySecret','%keyId',now(),'IN','%name',now(),0) \n";
var insertRazorpaySubclientCredentialTemplate = "insert into pm.razorpay_subclient_credential select 4,%mid,id_razorpay_credential,1 from pm.razorpay_credential where client_secret = '%keyId'; \n";
var razorPayGMCredentialsTemplate = '{\n"country": "IN",\n"operation": "ALL",\n"cvv_type": "ALL",\n"merchant_id":%mid,\n"description": "Razorpay - %name",\n"active": true,\n "gateway_id": 84,\n "credential_data": {\n"key_id":"%keyId",\n"key_secret": "%keySecret"\n}\n}\n';

function createRazorpayInserts() {
  var inserts = "";

  var mid = document.getElementById("rpMid").value;
  var name = document.getElementById("rpName").value;
  var rpPMKeyId = document.getElementById("rpPMKeyId").value;
  var rpGMKeyId = document.getElementById("rpGMKeyId").value;
  var rpPMKeySecret = document.getElementById("rpPMKeySecret").value;
  var rpGMKeySecret = document.getElementById("rpGMKeySecret").value;

  inserts += beautifyContent('Insert in GM', getRazorpayGMCredentialsInserts(mid, name, rpGMKeyId, rpGMKeySecret));
  inserts += beautifyContent('Insert in APC', getRazorpayAPCInserts(mid, name, rpPMKeyId, rpPMKeySecret));

  document.getElementById("content").innerText = inserts;
}

function getRazorpayGMCredentialsInserts(mid, name, keyId, keySecret) {
  return razorPayGMCredentialsTemplate
    .replace(/%mid/g, mid)
    .replace(/%name/g, name)
    .replace(/%keyId/g, keyId)
    .replace(/%keySecret/g, keySecret);
}

function getRazorpayAPCInserts(mid, name, keyId, keySecret) {
  return getRazorPayCredentialInsert(name, keyId, keySecret).concat(getRazorpaySubclientCredentialInsert(mid, keyId));
}

function getRazorPayCredentialInsert(name, keyId, keySecret) {
  return insertRazorpayCredentialTemplate
    .replace(/%name/g, name)
    .replace(/%keyId/g, keyId)
    .replace(/%keySecret/g, keySecret);
}

function getRazorpaySubclientCredentialInsert(mid, keyId) {
  return insertRazorpaySubclientCredentialTemplate
    .replace(/%mid/g, mid)
    .replace(/%keyId/g, keyId);
}

// PayTM Inserts
var payTMGMCredentialsTemplate = '{\n"country": "IN",\n  "operation": "ALL",\n  "cvv_type": "ALL",\n  "merchant_id": %mid,\n  "description": "PayTM - %name",\n "gateway_id": 215,\n"active": true,\n"credential_data":\n{\n"merchant_id": "%paytmMid",\n "merchant_key": "%paytmMerchantKey"\n }\n}'

function createPayTMInserts() {
  var inserts = "";

  var mid = document.getElementById("ptMid").value;
  var name = document.getElementById("ptName").value;
  var ptMerchantId = document.getElementById("ptMerchantId").value;
  var ptMerchantKey = document.getElementById("ptMerchantKey").value;

  inserts += beautifyContent('Insert in GM', getPayTMGMCredentialsInserts(mid, name, ptMerchantId, ptMerchantKey));

  document.getElementById("content").innerText = inserts;
}

function getPayTMGMCredentialsInserts(mid, name, ptMerchantId, ptMerchantKey) {
  return payTMGMCredentialsTemplate
    .replace(/%mid/g, mid)
    .replace(/%name/g, name)
    .replace(/%paytmMid/g, ptMerchantId)
    .replace(/%paytmMerchantKey/g, ptMerchantKey);
}


// Flutterwave South Africa
var fultterwaveZAGMCardsCredentialsTemplate = '{\n"country": "%country",\n"operation": "ALL",\n"cvv_type": "ALL",\n"merchant_id":%mid,\n"description": "Flutterwave %country - %name",\n"active": true,\n "gateway_id": %gatewayId,\n "credential_data": {\n"public_key":"%publicKey",\n"secret_key": "%secretKey",\n"encryption_key": "%encryptionKey"\n}\n}\n';

function createFlutterwaveInserts() {
  var inserts = "";

  var mid = document.getElementById("fwMid").value;
  var name = document.getElementById("fwName").value;
  var fwPublicKey = document.getElementById("fwPublicKey").value;
  var fwKeySecret = document.getElementById("fwKeySecret").value;
  var fwEncryptionKey = document.getElementById("fwEncryptionKey").value;
  var fwCountry = document.querySelector('input[name="fwCountry"]:checked').value;

  if (fwCountry == 'NG') {
    inserts += beautifyContent('Cards ' + fwCountry, getFlutterwaveGMCredentialsInserts(mid, name, fwCountry, fwPublicKey, fwKeySecret, fwEncryptionKey, 90));
  } else if (fwCountry == 'ZA') {
    inserts += beautifyContent('Cards ' + fwCountry, getFlutterwaveGMCredentialsInserts(mid, name, fwCountry, fwPublicKey, fwKeySecret, fwEncryptionKey, 91));
    inserts += beautifyContent('Bank Transfers ' + fwCountry, getFlutterwaveGMCredentialsInserts(mid, name, fwCountry, fwPublicKey, fwKeySecret, fwEncryptionKey, 228));
  }

  document.getElementById("content").innerText = inserts;
}

function getFlutterwaveGMCredentialsInserts(mid, name, fwCountry, fwzaPublicKey, fwzaKeySecret, fwzaEncryptionKey, gatewayId) {
  return fultterwaveZAGMCardsCredentialsTemplate
    .replace(/%mid/g, mid)
    .replace(/%name/g, name)
    .replace(/%country/g, fwCountry)
    .replace(/%publicKey/g, fwzaPublicKey)
    .replace(/%secretKey/g, fwzaKeySecret)
    .replace(/%encryptionKey/g, fwzaEncryptionKey)
    .replace(/%gatewayId/g, gatewayId);
}

// Disable FPago Update
var disableFPagoUpdateTemplate = "UPDATE astropay.merchant_fpago set enabled = 0 where id_country not in (%countries) and id_merchant in (%mid);\n "

function disableFPago() {
  var countriesIds = "";
  var mid = document.getElementById("disableFPagoMid").value;
  var values = $("#disableFPagoSelect").chosen().val();

  for (var index in values) {
    var country = countriesList[values[index]];
    countriesIds = countriesIds == "" ? country.id : countriesIds + "," + country.id;
  }

  document.getElementById("content").innerText += beautifyContent('MID ' + mid, getFPagoUpdate(mid, countriesIds));
}

function getFPagoUpdate(mid, countriesIds) {
  return disableFPagoUpdateTemplate
    .replace(/%mid/g, mid)
    .replace(/%countries/g, countriesIds);
}

var insertCashoutMerchantTemplate = "INSERT INTO unipay.cashout_merchants(id_merchant, user, pass, secret_key, status, processing_fee, fixed_fee, processing_fee_responsible, merchant_fee, notification_url, use_secco, daily_limit, monthly_limit, transaction_limit, creation_date, cashout_batch_enabled, default_descriptor, limit_validation_enabled) VALUES (%mid,'%user', '%pass', '%secretKey', 1, 0.0, 0.0, 'Merchant', 0.00, %notificationUrl, 0, %dailyLimit, %monthlyLimit, %transactionLimit, now(), %showPayoutsPanel, '%merchantName', %applyLimits); \n";
var cashoutIPTemplate = "INSERT INTO unipay.cashout_merchants_ips (id_merchant, ip) values (%mid, '%ip'); \n";
var insertPayoutFee = "insert into unipay.cashout_merchant_fee(id_cashout_merchant_fee, id_merchant, id_country, processing_fee_percent, processing_fee_amount, rejection_fee_amount, processing_responsible, merchant_fee_percent, minimun_fee_amount, minimun_amount, financial_trans_tax, application_date, enabled) VALUES (NULL, %mid, %country, %processingFeePercent, %processingFeeAmount, %rejectionFeeAmount,%processingFeeResponsible,%merchantFeePercent,%minimunFeeAmount,%minimunAmount,0.0,now(),1); \n"

function createPayoutsInserts() {
  var mid = document.getElementById("payoutMid").value;
  var user = document.getElementById("payoutUser").value;
  var pass = document.getElementById("payoutPass").value;
  var secretKey = document.getElementById("payoutSecretKey").value;
  var notificationUrl = "'https://test.dlocal.com/'";
  //  var notificationUrl =document.getElementById("payoutNotificationUrl").value;
  var merchantName = document.getElementById("payoutMerchantName").value;
  var showPayoutsInPanel = document.getElementById("showPayoutsPanel").checked ? 1 : 0;
  var applyLimits = document.getElementById("applyPayoutLimits").checked ? 1 : 0;
  var dailyLimit = applyLimits ? document.getElementById("payoutDailyLimit").value : 9999.00;
  var monthlyLimit = applyLimits ? document.getElementById("payoutMonthlyLimit").value : 9999.00;
  var transactionLimit = applyLimits ? document.getElementById("payoutTransactionLimit").value : 9999.00;

  document.getElementById("content").innerText += beautifyContent('Create the merchant in the payouts table', getPayoutInsert(mid, user, pass, secretKey, notificationUrl, merchantName, showPayoutsInPanel, applyLimits, dailyLimit, monthlyLimit, transactionLimit));
  if (showPayoutsInPanel)
    document.getElementById("content").innerText += beautifyContent('Whitelist panel ip', getIPInsert(mid, '54.229.6.202'));
}

function getPayoutInsert(mid, user, pass, secretKey, notificationUrl, merchantName, showPayoutsPanel, applyLimits, dailyLimit, monthlyLimit, transactionLimit) {
  return insertCashoutMerchantTemplate
    .replace(/%mid/g, mid)
    .replace(/%user/g, user)
    .replace(/%pass/g, pass)
    .replace(/%secretKey/g, secretKey)
    .replace(/%notificationUrl/g, notificationUrl)
    .replace(/%dailyLimit/g, dailyLimit)
    .replace(/%monthlyLimit/g, monthlyLimit)
    .replace(/%transactionLimit/g, transactionLimit)
    .replace(/%showPayoutsPanel/g, showPayoutsPanel)
    .replace(/%merchantName/g, merchantName)
    .replace(/%applyLimits/g, applyLimits);
}

function getIPInsert(mid, ip) {
  return cashoutIPTemplate
    .replace(/%mid/g, mid)
    .replace(/%ip/g, ip);
}

function createPayoutsFeeInserts() {
  var mid = document.getElementById("payoutMid").value;
  var selectedCountry = findSelectedCountryInSelectWithId("payoutCountriesSelect");
  var processingFeePercent = getValue(document.getElementById("payoutProcessingFeePercentByCountry").value);
  var processingFeeAmount = getValue(document.getElementById("payoutProcessingFeeAmountByCountry").value);
  var rejectionFeeAmount = getValue(document.getElementById("payoutRejectionFeeAmountByCountry").value);
  var merchantFeePercent = getValue(document.getElementById("payoutMerchantFeePercentByCountry").value);
  var minimumFeeAmount = getValue(document.getElementById("payoutMinimumFeeAmountByCountry").value);
  var minimumAmount = getValue(document.getElementById("payoutMinimumAmountByCountry").value);


  document.getElementById("content").innerText += beautifyContent(selectedCountry.fullName, selectedCountry.getPayoutFeeInsert(mid, processingFeePercent, processingFeeAmount, rejectionFeeAmount, "'Merchant'", merchantFeePercent, minimumFeeAmount, minimumAmount) + selectedCountry.getPayoutTaxInsert(mid, 'Merchant'));
}

function getValue(value) {
  return value != "" ? value : 0.00;
}

function enablePayoutLimits() {
  var checkBox = document.getElementById("applyPayoutLimits");
  var div = document.getElementById("limits");
  div.style.display = checkBox.checked ? "inherit" : "none";
}
