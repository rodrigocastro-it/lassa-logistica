import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

// Ícone padrão do Leaflet via CDN — evita o problema clássico de bundler
// não encontrar os PNGs do pacote leaflet.
const icone = L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

export default function MapaVeiculo({ latitude, longitude, popup, altura = '300px' }) {
    const divRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);

    useEffect(() => {
        if (!divRef.current || mapRef.current) return;
        // Zoom por scroll começa desligado -- senão, ao rolar a página pra
        // baixo passando por cima do mapa, o scroll vira zoom em vez de
        // continuar descendo a tela. Só liga quando a pessoa clica no mapa
        // (sinalizando que quer mesmo interagir com ele) e desliga de novo
        // quando o mouse sai, pra não ficar "preso".
        mapRef.current = L.map(divRef.current, { scrollWheelZoom: false }).setView([latitude, longitude], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(mapRef.current);

        mapRef.current.on('click', () => mapRef.current.scrollWheelZoom.enable());
        divRef.current.addEventListener('mouseleave', () => mapRef.current?.scrollWheelZoom.disable());

        return () => {
            mapRef.current?.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!mapRef.current || latitude == null || longitude == null) return;

        if (!markerRef.current) {
            markerRef.current = L.marker([latitude, longitude], { icon: icone }).addTo(mapRef.current);
        } else {
            markerRef.current.setLatLng([latitude, longitude]);
        }
        if (popup) markerRef.current.bindPopup(popup);
        mapRef.current.setView([latitude, longitude]);
    }, [latitude, longitude, popup]);

    return <div ref={divRef} style={{ height: altura, width: '100%', borderRadius: '0.75rem' }} />;
}
