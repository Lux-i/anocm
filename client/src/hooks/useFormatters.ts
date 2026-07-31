import { useTranslation } from "react-i18next";
import { formatTimestamp as _formatTimestamp } from "../utils/formatting";
import { formatTTL as _formatTTL } from "../utils/ttl";

export const useFormatters = () => {
    const { t } = useTranslation();

    const formatTimestamp = (date: Date) => _formatTimestamp(date, t);
    const formatTTL = (seconds: number) => _formatTTL(seconds, t);

    return { formatTimestamp, formatTTL };
};