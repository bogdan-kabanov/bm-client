const fs = require('fs');
const path = require('path');

const langsDir = __dirname;
const files = fs.readdirSync(langsDir).filter(f => f.endsWith('.json') && f !== 'en.json' && f !== 'ru.json');

const newKeys = {
  deposit: {
    selectMethod: 'Please select a payment method',
    enterName: 'Please enter your first and last name',
    enterCardNumber: 'Please enter a valid card number',
    enterCardExpire: 'Please enter card expiration date in MM/YY format',
    invalidCardMonth: 'Card expiration month must be between 01 and 12',
    cardExpired: 'Card expiration date cannot be in the past',
    invalidCardYear: 'Card expiration year is too far in the future',
    enterCardCvc: 'Please enter card CVC code (3 digits)',
    walletRequired: 'Phone number or wallet is required for this payment method',
    transactionCreatedNoRedirect: 'Transaction created, but unable to redirect to payment page.',
    transactionCreatedNoData: 'Transaction created, but payment details are not available. Please check your transactions.',
    methodNotSupported: 'This payment method is not yet supported',
    back: 'Back',
    qrCode: 'QR Code',
    downloadQr: 'Download QR Code',
    vaCode: 'VA Code',
    matchCode: 'Match Code',
    bankName: 'Bank Name',
    recipient: 'Recipient',
    cardExpire: 'Expiry date',
    cardCvc: 'CVC',
    qrPaymentInstructions: 'Scan the QR code with your banking app to complete the payment. The transaction will be processed automatically after the payment is received.',
    accountStatus: 'Account status',
    phoneOrWallet: 'Phone number or wallet',
    phoneOrWalletPlaceholder: 'Enter phone number or wallet',
    dataFromProfile: 'Data from your profile',
    goToProfile: 'Go to profile to fill in the data'
  },
  withdrawal: {
    chooseAmount: 'Choose withdrawal amount',
    enterAmount: 'Enter amount',
    minAmount: 'Min',
    maxAmount: 'Max',
    youWillReceive: 'You will receive',
    walletAddress: 'Wallet address',
    saved: 'Saved',
    enterWalletAddress: 'Enter wallet address',
    save: 'Save',
    walletNote: 'Make sure the address is correct. Transactions cannot be reversed.',
    secure: 'Secure',
    secureDescription: 'All transactions are encrypted and secure',
    fast: 'Fast processing',
    fastDescription: 'Withdrawals are processed within 24 hours',
    verified: 'Verified',
    verifiedDescription: 'All withdrawal methods are verified and trusted',
    chooseMethod: 'Choose withdrawal method',
    popular: 'Popular',
    bankCards: 'Bank cards',
    crypto: 'Cryptocurrency'
  },
  errors: {
    paymentMethodUnavailable: 'Payment method is temporarily unavailable. Please try again later or choose another payment method.',
    noFreeRequisites: 'No free payment details available at the moment. Please try again later or choose another payment method.',
    paymentGatewayUnavailable: 'Payment gateway is temporarily unavailable. Please try again later or choose another payment method.'
  }
};

files.forEach(file => {
  const filePath = path.join(langsDir, file);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    // Add deposit keys
    if (!data.deposit) data.deposit = {};
    Object.keys(newKeys.deposit).forEach(key => {
      if (!data.deposit[key]) {
        data.deposit[key] = newKeys.deposit[key];
      }
    });
    
    // Add withdrawal keys
    if (!data.withdrawal) data.withdrawal = {};
    Object.keys(newKeys.withdrawal).forEach(key => {
      if (!data.withdrawal[key]) {
        data.withdrawal[key] = newKeys.withdrawal[key];
      }
    });
    
    // Add errors keys
    if (!data.errors) data.errors = {};
    Object.keys(newKeys.errors).forEach(key => {
      if (!data.errors[key]) {
        data.errors[key] = newKeys.errors[key];
      }
    });
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`Updated ${file}`);
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
});

console.log('Done!');

