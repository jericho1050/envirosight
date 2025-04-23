import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MapComponent from '../components/map-component';
import * as apiClient from '@/lib/api-client';
import * as useMobileHook from '@/hooks/use-mobile';
import L from 'leaflet';

// --- Mocks ---

// Mock Leaflet library
jest.mock('leaflet', () => {
    const L = jest.requireActual('leaflet'); // Use actual Leaflet for L.LatLngBounds etc. if needed

    // Mock the parts that cause issues in JSDOM or need specific behavior
    return {
        ...L,
        map: jest.fn(() => ({
            setView: jest.fn(),
            getBounds: jest.fn(() => L.latLngBounds([
                [50, -125],
                [25, -65]
            ])), // Default bounds
            on: jest.fn(),
            off: jest.fn(),
            remove: jest.fn(),
            // Add other methods if needed by the component
        })),
        icon: jest.fn((options) => ({ options })), // Mock icon creation
        divIcon: jest.fn((options) => ({ options })), // Mock divIcon creation
        marker: jest.fn(() => ({
            addTo: jest.fn(),
            bindPopup: jest.fn().mockReturnThis(),
            on: jest.fn(),
        })),
        polygon: jest.fn(() => ({
            addTo: jest.fn(),
            bindTooltip: jest.fn().mockReturnThis(),
            setStyle: jest.fn(),
        })),
        layerGroup: jest.fn(() => ({
            addTo: jest.fn(),
            clearLayers: jest.fn(),
            addLayer: jest.fn(),
            removeLayer: jest.fn(), // Mock removeLayer
        })),
        tileLayer: jest.fn(() => ({
            addTo: jest.fn(),
        })),
        // Mock other Leaflet classes/functions if necessary
    };
});


// Mock react-leaflet components and hooks
jest.mock('react-leaflet', () => ({
    MapContainer: ({ children, whenCreated }: { children: React.ReactNode, whenCreated: (map: L.Map) => void }) => {
        // Simulate map creation and call whenCreated
        const mockMap = L.map('mock-map-id'); // Use the mocked L.map
        React.useEffect(() => {
            if (whenCreated) {
                whenCreated(mockMap);
            }
            // Cleanup function for map removal
            return () => {
                mockMap.remove();
            };
        }, [whenCreated, mockMap]);
        return <div data-testid="map-container">{children}</div>;
    },
    TileLayer: () => <div data-testid="tile-layer"></div>,
    Marker: ({ children, icon }: { children?: React.ReactNode, icon?: any }) => (
        <div data-testid="marker" data-icon-options={icon ? JSON.stringify(icon.options) : null}>
            {children}
        </div>
    ),
    Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
    Polygon: ({ positions }: { positions: any }) => <div data-testid="polygon" data-positions={JSON.stringify(positions)}></div>,
    Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
    LayerGroup: ({ children }: { children: React.ReactNode }) => <div data-testid="layer-group">{children}</div>,
    useMap: () => L.map('mock-usemap-id'), // Use the mocked L.map here too
}));

// Mock API client
jest.mock('@/lib/api-client', () => ({
    fetchHazardSites: jest.fn(),
    fetchAQIData: jest.fn(),
}));

// Mock child components
jest.mock('../components/layer-control', () => ({ onToggle }: { onToggle: (name: string) => void }) => (
    <div data-testid="layer-control">
        <button onClick={() => onToggle('hazardSites')}>Toggle Hazard</button>
        <button onClick={() => onToggle('aqiStations')}>Toggle AQI</button>
        <button onClick={() => onToggle('prediction')}>Toggle Prediction</button>
    </div>
));
jest.mock('../components/prediction-panel', () => ({ onPredictionResult, onClear }: any) => (
    <div data-testid="prediction-panel">
        <button onClick={() => onPredictionResult({
            center: { lat: 40, lng: -90 }, // Correct format
            polygon: [[41, -91], [39, -89]],
            properties: { windSpeed: 5, windDirection: 180, timestamp: Date.now() }
        })}>Predict</button>
        <button onClick={onClear}>Clear Prediction</button>
    </div>
));
jest.mock('../components/search-location', () => () => <div data-testid="search-location"></div>);
jest.mock('../components/draggable-wrapper', () => ({ children }: { children: React.ReactNode }) => <div data-testid="draggable-wrapper">{children}</div>);

// Mock hooks
jest.mock('@/hooks/use-mobile', () => ({
    useIsMobile: jest.fn(),
}));

// Mock Geolocation API
const mockGeolocation = {
    getCurrentPosition: jest.fn((success, error) => success({ coords: { latitude: 51.505, longitude: -0.09 } })),
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
};
Object.defineProperty(global.navigator, 'geolocation', {
    value: mockGeolocation,
    writable: true,
});

// --- Test Data ---
const mockHazardSitesData = [
    { id: 'h1', name: 'Hazard Site 1', latitude: 35.1, longitude: -95.1, type: 'Waste' },
    { id: 'h2', name: 'Hazard Site 2', latitude: 35.2, longitude: -95.2, type: 'Chemical' },
];
const mockAqiData = [
    { id: 'a1', name: 'AQI Station 1', latitude: 35.3, longitude: -95.3, aqi: 55 },
    { id: 'a2', name: 'AQI Station 2', latitude: 35.4, longitude: -95.4, aqi: 110 },
];

// --- Test Suite ---

describe('MapComponent', () => {
    let fetchHazardSitesMock: jest.Mock;
    let fetchAQIDataMock: jest.Mock;
    let useIsMobileMock: jest.Mock;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        fetchHazardSitesMock = apiClient.fetchHazardSites as jest.Mock;
        fetchAQIDataMock = apiClient.fetchAQIData as jest.Mock;
        useIsMobileMock = useMobileHook.useIsMobile as jest.Mock;

        // Default mock implementations
        fetchHazardSitesMock.mockResolvedValue(mockHazardSitesData);
        fetchAQIDataMock.mockResolvedValue(mockAqiData);
        useIsMobileMock.mockReturnValue(false); // Default to desktop
        mockGeolocation.getCurrentPosition.mockImplementation((success) =>
            Promise.resolve(success({ coords: { latitude: 51.505, longitude: -0.09 } }))
        );
    });

    test('renders MapContainer and child components', () => {
        render(<MapComponent />);
        expect(screen.getByTestId('map-container')).toBeInTheDocument();
        expect(screen.getByTestId('tile-layer')).toBeInTheDocument();
        expect(screen.getByTestId('layer-control')).toBeInTheDocument();
        expect(screen.getByTestId('prediction-panel')).toBeInTheDocument();
        expect(screen.getByTestId('search-location')).toBeInTheDocument();
        // LocationFinder button should be present initially
        expect(screen.getByTitle('Find my location')).toBeInTheDocument();
    });

    test('calls fetchHazardSites and fetchAQIData on initial load', async () => {
        render(<MapComponent />);
        await waitFor(() => {
            expect(fetchHazardSitesMock).toHaveBeenCalledTimes(1);
            expect(fetchAQIDataMock).toHaveBeenCalledTimes(1);
        });
        // Check if called with the default bounds from the mock map
        const expectedBounds = { north: 50, south: 25, east: -65, west: -125 };
        expect(fetchHazardSitesMock).toHaveBeenCalledWith(expectedBounds);
        expect(fetchAQIDataMock).toHaveBeenCalledWith(expectedBounds);
    });

    test('displays loading indicator initially', () => {
        // Prevent API calls from resolving immediately
        fetchHazardSitesMock.mockImplementation(() => new Promise(() => { }));
        fetchAQIDataMock.mockImplementation(() => new Promise(() => { }));
        render(<MapComponent />);
        expect(screen.getByTestId('map-loader')).toBeInTheDocument();
    });

    test('displays markers after data is loaded', async () => {
        render(<MapComponent />);
        await waitFor(() => {
            // Expect markers for hazard sites and AQI stations
            // Note: We check for the generic 'marker' testid from our mock
            const markers = screen.getAllByTestId('marker');
            // 2 hazard sites + 2 AQI stations = 4 markers
            expect(markers).toHaveLength(mockHazardSitesData.length + mockAqiData.length);
        });
        // Optionally check if icons were created (indirectly via marker props)
        // This checks if the mock L.divIcon was called, implying createHazardIcon/createAQIIcon were invoked
        expect(L.divIcon).toHaveBeenCalled();
    });

    test('displays error message if data fetching fails', async () => {
        const errorMsg = 'Failed to load data';
        fetchHazardSitesMock.mockRejectedValue(new Error(errorMsg));
        fetchAQIDataMock.mockRejectedValue(new Error(errorMsg)); // Make both fail for simplicity
        render(<MapComponent />);

        await waitFor(() => {
            // Check for specific error text or a generic error alert
            // Using text matching as an example
            expect(screen.getByText(/Failed to load hazard site data/i)).toBeInTheDocument();
            expect(screen.getByText(/Also failed to load AQI data/i)).toBeInTheDocument();
        });
        // Check if mock data is shown (assuming mock data is used as fallback)
        await waitFor(() => {
            // Check for markers corresponding to mock data if the component falls back
            // This depends on the exact implementation of the error handling in MapComponent
            // For now, just check the error message is present.
        });
    });

    test('LocationFinder button calls geolocation API', async () => {
        render(<MapComponent />);
        const locationButton = screen.getByTitle('Find my location');
        fireEvent.click(locationButton);

        await waitFor(() => {
            const calls = (L.map as jest.Mock).mock.results;
            // useMap returns second map instance
            const useMapInstance = calls[1].value;
            expect(useMapInstance.setView).toHaveBeenCalledWith([51.505, -0.09], 10);
        });
    });

    test('LocationFinder shows error message on geolocation failure', async () => {
        const error = new Error("Permission denied");
        (error as any).code = 1; // PERMISSION_DENIED
        mockGeolocation.getCurrentPosition.mockImplementation((_, errorCallback) => errorCallback(error));

        render(<MapComponent />);
        const locationButton = screen.getByTitle('Find my location');
        fireEvent.click(locationButton);

        await waitFor(() => {
            // Match the specific error message for code 1
            expect(screen.getByText(/Location permission denied. Please enable location access/i)).toBeInTheDocument();
        });
        // Check if map view defaulted to US center
        await waitFor(() => {
            const calls = (L.map as jest.Mock).mock.results;
            const useMapInstance = calls[1].value;
            expect(useMapInstance.setView).toHaveBeenCalledWith([39.8283, -98.5795], 4);
        });
    });

    test('toggles layer visibility via LayerControl', async () => {
        render(<MapComponent />);
        await waitFor(() => {
            expect(screen.getAllByTestId('marker')).toHaveLength(4);
        });

        const toggleHazardButton = screen.getByRole('button', { name: /Toggle Hazard/i });
        fireEvent.click(toggleHazardButton);
        // No assertion here - ensure no errors

        const toggleAqiButton = screen.getByRole('button', { name: /Toggle AQI/i });
        fireEvent.click(toggleAqiButton);
    });

    test('renders mobile layout when useIsMobile returns true', () => {
        useIsMobileMock.mockReturnValue(true);
        render(<MapComponent />);
        expect(screen.getByTestId('mobile-menu-button')).toBeInTheDocument();

        // Toggle mobile panel open
        fireEvent.click(screen.getByTestId('mobile-menu-button'));
        // Controls panel should be visible
        expect(screen.getByTestId('search-location')).toBeInTheDocument();
    });

});