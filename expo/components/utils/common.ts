export const Format_Date = (strDate: string | number | Date | null | undefined): string => {
    if (!strDate) return "";
  
    const date = new Date(strDate);
  
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
  
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
  
    return `${dd}/${mm}/${yyyy} | ${hour}:${minute}`;
  };