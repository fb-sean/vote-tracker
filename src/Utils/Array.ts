export function sortArrayByStrings(array: string[]) {
    return array.sort((a, b) => a.localeCompare(b));
}