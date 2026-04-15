/**
 * UNIVERSAL SMS TEMPLATE ENGINE
 * Localized messages for 6 supported languages.
 */

export function generateVerificationSms(name: string, amount: number, token: string, language: string = 'en') {
  const templates: Record<string, string> = {
    en: `Namaste ${name}, VedaVoice Receipt: ₹${amount} received? \n\nConfirm: \nReply 1 for Yes \nReply 2 for No \n\nv.vd.in/${token}`,
    hi: `नमस्ते ${name}, वेदवॉइस रसीद: ₹${amount} मिला? \n\nपुष्टि करें: \nहाँ के लिए 1 \nनहीं के लिए 2 \n\nv.vd.in/${token}`,
    mr: `नमस्ते ${name}, वेदवॉइस पावती: ₹${amount} मिळाले? \n\nपुष्टी करा: \nहो साठी 1 \nनाही साठी 2 \n\nv.vd.in/${token}`,
    gu: `નમસ્તે ${name}, વેદવોઇસ પાવતી: ₹${amount} મળ્યા? \n\nપુષ્ટિ કરો: \nહા માટે 1 \nના માટે 2 \n\nv.vd.in/${token}`,
    bn: `নমস্তে ${name}, বেদভয়েস রসিদ: ₹${amount} পেয়েছেন? \n\nনিশ্চিত করুন: \nহ্যাঁ এর জন্য 1 \nনা এর জন্য 2 \n\nv.vd.in/${token}`,
    hinglish: `Namaste ${name}, VedaVoice Receipt: ₹${amount} mila? \n\nConfirm karein: \nHaan ke liye 1 \nNahi ke liye 2 \n\nv.vd.in/${token}`,
  };

  return templates[language] || templates.en;
}
