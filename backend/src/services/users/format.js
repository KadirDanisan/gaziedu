import {
  NORMAL_USER_GENDER_LABELS,
  NORMAL_USER_TYPE_LABELS,
  NORMAL_USER_COUNTRY_LABELS,
} from "../../utils/nationalId.js";

const formatNormalUserMeResponse = (user, details) => {
  const g = details?.gender != null && details.gender !== "" ? String(details.gender) : "";
  const ut = details?.user_type || null;
  const cc = details?.country_code != null && details.country_code !== "" ? String(details.country_code) : "";
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    fullName: `${user.first_name} ${user.last_name}`.trim(),
    email: user.email,
    nationalId: details?.national_id ? String(details.national_id) : "",
    gender: g,
    genderLabel: g ? NORMAL_USER_GENDER_LABELS[g] || g : "Seçim yapılmadı",
    userType: ut ? NORMAL_USER_TYPE_LABELS[ut] || ut : "Belirtilmedi",
    customerType: ut === "kurumsal" ? "2" : "1",
    addressLine1: details?.address_line1 ? String(details.address_line1) : "",
    addressLine2: details?.address_line2 ? String(details.address_line2) : "",
    countryCode: cc,
    countryLabel: cc ? NORMAL_USER_COUNTRY_LABELS[cc] || cc : "",
    city: details?.city ? String(details.city) : "",
    district: details?.district ? String(details.district) : "",
    postalCode: details?.postal_code ? String(details.postal_code) : "",
  };
};

export { formatNormalUserMeResponse };
