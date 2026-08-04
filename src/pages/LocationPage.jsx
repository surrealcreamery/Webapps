import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LocationModal } from '@/components/commerce/LocationModal';

const LOCATIONS_URL = 'https://data.surrealcreamery.com/locations.json';

export default function LocationPage() {
    const { locationId } = useParams();
    const navigate = useNavigate();
    const [locations, setLocations] = useState([]);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        fetch(LOCATIONS_URL)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setLocations(data);
                    const match = data.find(l => l.id === locationId);
                    if (match) {
                        localStorage.setItem('selectedLocation', locationId);
                        window.dispatchEvent(new CustomEvent('locationChanged', { detail: { locationId } }));
                        setReady(true);
                    } else {
                        navigate('/', { replace: true });
                    }
                } else {
                    navigate('/', { replace: true });
                }
            })
            .catch(() => navigate('/', { replace: true }));
    }, [locationId, navigate]);

    const handleClose = () => navigate('/', { replace: true });

    const handleSelectLocation = (id) => {
        localStorage.setItem('selectedLocation', id);
        window.dispatchEvent(new CustomEvent('locationChanged', { detail: { locationId: id } }));
        navigate('/', { replace: true });
    };

    if (!ready) return null;

    return (
        <LocationModal
            open
            onClose={handleClose}
            selectedLocationId={locationId}
            onSelectLocation={handleSelectLocation}
            locations={locations}
        />
    );
}
