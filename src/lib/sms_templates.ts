/**
 * UNIVERSAL SMS TEMPLATE ENGINE
 * Keeps Hinglish messages consistent across Simulation and Production.
 */

export function generateVerificationSms(name: string, amount: number, token: string) {
  // We use the 1/2 Keypad Protocol as the base template
  return `Namaste ${name}, VedaVoice Receipt: ₹${amount} mila? \n\nConfirm karein: \nHaan ke liye 1 \nNahi ke liye 2 \n\nv.vd.in/${token}`;
}
