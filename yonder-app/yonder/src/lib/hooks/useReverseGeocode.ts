import { useEffect, useState } from "react";

export function useReverseGeocode(
  latitude?: number | null,
  longitude?: number | null
) {
  const [shortAddress, setShortAddress] = useState<string | null>(null);
  const [fullAddress, setFullAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const NOT_FOUND_ADDRESS = "N/A";

  useEffect(() => {
    if (!latitude || !longitude) {
      setShortAddress(null);
      setFullAddress(null);
      return;
    }

    const fetchAddress = async () => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (!token) {
        console.error("Missing NEXT_PUBLIC_MAPBOX_TOKEN");
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${token}`
        );
        const data = await response.json();

        if (data.features && data.features.length > 0) {
          setShortAddress(data.features[0].text || NOT_FOUND_ADDRESS);
          setFullAddress(data.features[0].place_name || NOT_FOUND_ADDRESS);
        } else {
          setShortAddress(NOT_FOUND_ADDRESS);
          setFullAddress(NOT_FOUND_ADDRESS);
        }
      } catch (error) {
        console.error("Error fetching address:", error);
        setShortAddress(NOT_FOUND_ADDRESS);
        setFullAddress(NOT_FOUND_ADDRESS);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAddress();
  }, [latitude, longitude]);

  return { shortAddress, fullAddress, isLoading };
}
