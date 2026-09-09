export const DEFAULT_LANGUAGE='vi';

export const LANGUAGES=Object.freeze([
  Object.freeze({code:'vi',nativeName:'Tiếng Việt',promptName:'Vietnamese',mp4Code:'vie'}),
  Object.freeze({code:'en',nativeName:'English',promptName:'English',mp4Code:'eng'})
]);

export const SUPPORTED_LANGUAGES=new Set(LANGUAGES.map((language)=>language.code));

export function languageInfo(code) {
  return LANGUAGES.find((language)=>language.code===code)||LANGUAGES.find((language)=>language.code===DEFAULT_LANGUAGE);
}

export function normalizeLanguage(code,fallback=DEFAULT_LANGUAGE) {
  return SUPPORTED_LANGUAGES.has(code)?code:(SUPPORTED_LANGUAGES.has(fallback)?fallback:DEFAULT_LANGUAGE);
}
