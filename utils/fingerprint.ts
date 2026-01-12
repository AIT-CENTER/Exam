// utils/fingerprint.ts
import FingerprintJS from '@fingerprintjs/fingerprintjs';

export const getBrowserFingerprint = async (): Promise<string> => {
  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    return result.visitorId;
  } catch (error) {
    // Fallback to simpler fingerprint
    const fallbackId = [
      navigator.userAgent,
      navigator.language,
      screen.colorDepth,
      screen.width,
      screen.height,
      new Date().getTimezoneOffset(),
      !!navigator.cookieEnabled,
      !!navigator.doNotTrack
    ].join('|');
    
    return btoa(fallbackId).substring(0, 32);
  }
};

export const getIPAddress = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return 'unknown';
  }
};