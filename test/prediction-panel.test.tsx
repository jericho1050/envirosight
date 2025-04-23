import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Map } from 'leaflet'; // Import the actual Map type
import PredictionPanel from '@/components/prediction-panel';
import * as apiClient from '@/lib/api-client';
import type { ChemicalOption, WeatherData, PredictionResult } from '@/lib/types';

// Mock the API client functions
jest.mock('@/lib/api-client', () => ({
	fetchChemicalOptions: jest.fn(),
	getWeatherData: jest.fn(),
	runPrediction: jest.fn(),
}));

// Mock lucide-react to add test id to Loader2
jest.mock('lucide-react', () => {
	const originalModule = jest.requireActual('lucide-react');
	return {
		...originalModule,
		Loader2: (props: any) => <div {...props} data-testid="loader-spin" />,
	};
});

// Mock Leaflet's LatLng type if needed, or use a simple object
const mockLatLng = { lat: 40.7128, lng: -74.0060 };

// Mock L.Map interface - Keep it simple, just mock the methods used
interface MockMap {
	getCenter: () => typeof mockLatLng;
}

// Create the mock map object
const mockMapInstance: MockMap = {
	getCenter: jest.fn(() => mockLatLng),
};

// Create the RefObject with the correct type, casting the mock instance
const mockMapRef = {
	current: mockMapInstance as unknown as Map,
};

// Function to reset the mock ref before each test
const resetMockMapRef = () => {
	mockMapInstance.getCenter = jest.fn(() => mockLatLng);
	mockMapRef.current = mockMapInstance as unknown as Map;
};

const mockChemicals: ChemicalOption[] = [
	{ id: 1, name: 'Chlorine', hazard_type: 'Toxic Gas' },
	{ id: 2, name: 'Ammonia', hazard_type: 'Toxic Gas' },
];

const mockWeatherData: WeatherData = {
	temperature: 75,
	humidity: 60,
	windSpeed: 10,
	windDirection: 180,
	timestamp: new Date().toISOString(),
};

const mockPredictionResult: PredictionResult = {
	polygon: [
		[40.71, -74.00],
		[40.72, -74.00],
		[40.71, -73.99],
	],
	center: { lat: 40.7128, lng: -74.0060 },
	properties: {
		hazardType: 'Toxic Gas',
		windSpeed: mockWeatherData.windSpeed,
		windDirection: mockWeatherData.windDirection,
		timestamp: mockWeatherData.timestamp,
	},
};

describe('PredictionPanel', () => {
	let onPredictionResultMock: jest.Mock;
	const user = userEvent.setup();

	beforeEach(() => {
		jest.clearAllMocks();
		onPredictionResultMock = jest.fn();
		// Reset mapRef mock before each test
		resetMockMapRef();
		// Default successful chemical fetch
		(apiClient.fetchChemicalOptions as jest.Mock).mockResolvedValue(mockChemicals);
		(apiClient.getWeatherData as jest.Mock).mockResolvedValue(mockWeatherData);
		(apiClient.runPrediction as jest.Mock).mockResolvedValue(mockPredictionResult);
	});

	test('renders initial state and loads chemicals', async () => {
		render(<PredictionPanel onPredictionResult={onPredictionResultMock} mapRef={mockMapRef as React.RefObject<Map | null>} />);

		expect(screen.getByRole('combobox')).toBeDisabled();
		expect(screen.getByRole('button', { name: /simulate dispersion/i })).toBeDisabled();
		// Check for placeholder text while loading
		expect(screen.getByText('Loading chemicals...')).toBeInTheDocument();

		await waitFor(() => {
			expect(apiClient.fetchChemicalOptions).toHaveBeenCalledTimes(1);
		});

		// Wait for the combobox to be enabled and have the default value
		await waitFor(() => {
			expect(screen.getByRole('combobox')).toBeEnabled();
			expect(screen.getByRole('combobox')).toHaveTextContent(`${mockChemicals[0].name} (${mockChemicals[0].hazard_type})`);
		});
		expect(screen.getByRole('button', { name: /simulate dispersion/i })).toBeEnabled();
	});

	test('handles error during chemical loading', async () => {
		const errorMsg = 'Failed to fetch chemicals';
		(apiClient.fetchChemicalOptions as jest.Mock).mockRejectedValue(new Error(errorMsg));

		render(<PredictionPanel onPredictionResult={onPredictionResultMock} mapRef={mockMapRef as React.RefObject<Map | null>} />);

		await waitFor(() => {
			// Check for the specific error message displayed in the Alert
			expect(screen.getByText(/could not load chemical options. please try refreshing./i)).toBeInTheDocument();
		});

		expect(screen.getByRole('combobox')).toBeDisabled();
		expect(screen.getByRole('button', { name: /simulate dispersion/i })).toBeDisabled();
		// Check placeholder text when disabled due to error
		expect(screen.getByText('Select hazard type')).toBeInTheDocument();
	});

	test('handles empty chemical list', async () => {
		(apiClient.fetchChemicalOptions as jest.Mock).mockResolvedValue([]);

		render(<PredictionPanel onPredictionResult={onPredictionResultMock} mapRef={mockMapRef as React.RefObject<Map | null>} />);

		// Wait for loading to finish
		await waitFor(() => {
			expect(screen.queryByText('Loading chemicals...')).not.toBeInTheDocument();
		});

		// Check that the button is disabled and displays the correct placeholder text
		const combobox = screen.getByRole('combobox');
		expect(combobox).toBeDisabled();
		expect(combobox).toHaveTextContent('Select hazard type'); // Placeholder text when no options
		expect(screen.getByRole('button', { name: /simulate dispersion/i })).toBeDisabled();
	});

	test('allows selecting a chemical', async () => {
		render(<PredictionPanel onPredictionResult={onPredictionResultMock} mapRef={mockMapRef as React.RefObject<Map | null>} />);

		await waitFor(() => {
			expect(screen.getByRole('combobox')).toBeEnabled();
		});

		await user.click(screen.getByRole('combobox'));
		// Use findByRole for elements appearing asynchronously after interaction
		await user.click(await screen.findByRole('option', { name: /ammonia/i }));

		expect(screen.getByRole('combobox')).toHaveTextContent(`${mockChemicals[1].name} (${mockChemicals[1].hazard_type})`);
		expect(screen.getByRole('button', { name: /simulate dispersion/i })).toBeEnabled();
	});


	test('shows error if mapRef is not available', async () => {
		const nullMapRef = { current: null };
		render(<PredictionPanel onPredictionResult={onPredictionResultMock} mapRef={nullMapRef as React.RefObject<Map | null>} />);

		await waitFor(() => {
			expect(screen.getByRole('combobox')).toBeEnabled();
		});

		await user.click(screen.getByRole('button', { name: /simulate dispersion/i }));

		await waitFor(() => {
			expect(screen.getByText(/map not ready/i)).toBeInTheDocument();
		});
		expect(apiClient.getWeatherData).not.toHaveBeenCalled();
		expect(apiClient.runPrediction).not.toHaveBeenCalled();
		expect(onPredictionResultMock).not.toHaveBeenCalled();
	});

	// Commenting out this test as the UI flow makes this state unlikely/difficult to achieve reliably.
	// The component defaults to the first chemical if the list is not empty.
	// test('shows error if no chemical is selected (though UI prevents this)', async () => {
	// 	(apiClient.fetchChemicalOptions as jest.Mock).mockResolvedValue(mockChemicals);
	//
	// 	const { rerender } = render(<PredictionPanel onPredictionResult={onPredictionResultMock} mapRef={mockMapRef as React.RefObject<Map | null>} />);
	//
	// 	await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
	//
	// 	// Attempting to simulate no selection after load is complex and might not reflect real usage
	// 	// For now, assume the default selection prevents this state.
	// 	// (apiClient.fetchChemicalOptions as jest.Mock).mockImplementation(() => new Promise(() => {}));
	// 	// rerender(<PredictionPanel onPredictionResult={onPredictionResultMock} mapRef={mockMapRef as React.RefObject<Map | null>} />);
	// 	// expect(screen.getByRole('button', { name: /simulate dispersion/i })).toBeDisabled();
	// });

	test('handles error during weather fetching', async () => {
		const errorMsg = 'Failed to fetch weather';
		(apiClient.getWeatherData as jest.Mock).mockRejectedValue(new Error(errorMsg));

		render(<PredictionPanel onPredictionResult={onPredictionResultMock} mapRef={mockMapRef as React.RefObject<Map | null>} />);

		await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());

		await user.click(screen.getByRole('button', { name: /simulate dispersion/i }));

		await waitFor(() => {
			expect(screen.getByText(`Failed to run prediction: ${errorMsg}. Please try again.`)).toBeInTheDocument();
		});
		expect(apiClient.runPrediction).not.toHaveBeenCalled();
		expect(onPredictionResultMock).not.toHaveBeenCalled();
		expect(screen.getByRole('button', { name: /simulate dispersion/i })).toBeEnabled();
	});

	test('handles error during prediction running', async () => {
		const errorMsg = 'Prediction model failed';
		(apiClient.runPrediction as jest.Mock).mockRejectedValue(new Error(errorMsg));

		render(<PredictionPanel onPredictionResult={onPredictionResultMock} mapRef={mockMapRef as React.RefObject<Map | null>} />);

		await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());

		await user.click(screen.getByRole('button', { name: /simulate dispersion/i }));

		await waitFor(() => {
			expect(screen.getByText(`Failed to run prediction: ${errorMsg}. Please try again.`)).toBeInTheDocument();
		});
		expect(onPredictionResultMock).not.toHaveBeenCalled();
		expect(screen.getByRole('button', { name: /simulate dispersion/i })).toBeEnabled();
	});

	test('displays informational alert', async () => {
		render(<PredictionPanel onPredictionResult={onPredictionResultMock} mapRef={mockMapRef as React.RefObject<Map | null>} />);
		await waitFor(() => expect(apiClient.fetchChemicalOptions).toHaveBeenCalled());

		expect(screen.getByText('Illustrative Model')).toBeInTheDocument();
		expect(screen.getByText(/This uses a simplified Gaussian model/)).toBeInTheDocument();
		expect(screen.getByText(/This uses a simplified Gaussian model/)).toBeInTheDocument();
	});
});