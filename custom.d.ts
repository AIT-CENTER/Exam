// custom.d.ts

declare module '*.pdf' {
  const content: string;
  export default content;
}