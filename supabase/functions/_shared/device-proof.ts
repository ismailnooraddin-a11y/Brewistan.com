export interface RegistrationContext {
 userId:string;sessionId:string;publicKey:string;platform:string;deviceId?:string|null;pushToken?:string|null;proofAt:number;
}
export function registrationMessage(c:RegistrationContext):string {
 return JSON.stringify(['BW-REGISTER-1',c.userId,c.sessionId,c.publicKey,c.platform,c.deviceId??null,c.pushToken??null,c.proofAt]);
}
export function registrationTimeValid(proofAt:unknown,now=Date.now()):boolean {
 return typeof proofAt==='number'&&Number.isSafeInteger(proofAt)&&Math.abs(now-proofAt)<=120000;
}
