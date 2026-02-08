export function IsLink(text: string) {
    return text.match(/https?:\/\/[^\s]+/g);
}