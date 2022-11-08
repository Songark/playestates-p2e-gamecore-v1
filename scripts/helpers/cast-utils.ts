const uritoJson = (uri: string) => {
    // 29 = length of "data:application/json;base64,"
    const json = atob(uri.substring(29));
    const result = JSON.parse(json);
    return result;
}
const hasValues = (obj:any) => Object.values(obj).some(v => v !== null && typeof v !== "undefined")

export {
    uritoJson,
    hasValues
}