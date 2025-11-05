import React, { useState, useEffect, useCallback } from 'react';
import { optimizeRoute } from './services/geminiService';
import { GroundingChunk, ProcessedRouteStep, SavedRoute } from './types';
import { 
  MapPinIcon, RouteIcon, WarehouseIcon, SparklesIcon, ExternalLinkIcon, ClockIcon, MapIcon, 
  SaveIcon, HistoryIcon, TrashIcon, RecalculateIcon 
} from './components/icons';


const App: React.FC = () => {
  const [startAddress, setStartAddress] = useState<string>('Sydney, NSW, Australia');
  const [deliveryAddresses, setDeliveryAddresses] = useState<string>('');
  const [optimizedRoute, setOptimizedRoute] = useState<ProcessedRouteStep[] | null>(null);
  const [totalTravelTime, setTotalTravelTime] = useState<string | null>(null);
  const [grounding, setGrounding] = useState<GroundingChunk[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number; } | null>(null);
  const [googleMapsUrl, setGoogleMapsUrl] = useState<string | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (geoError) => {
        console.warn("Geolocation permission denied or unavailable. Proceeding without user location.", geoError);
      }
    );
    
    // Load saved routes from localStorage on initial render
    const storedRoutes = localStorage.getItem('deliveryRoutes');
    if (storedRoutes) {
        setSavedRoutes(JSON.parse(storedRoutes));
    }
  }, []);

  useEffect(() => {
    if (optimizedRoute && optimizedRoute.length > 1) {
      const baseUrl = 'https://www.google.com/maps/dir/';
      const addresses = optimizedRoute
        .map(step => encodeURIComponent(step.address))
        .join('/');
        
      setGoogleMapsUrl(`${baseUrl}${addresses}`);
    } else {
      setGoogleMapsUrl(null);
    }
  }, [optimizedRoute]);
  
  const parseDuration = (durationStr: string): number => {
    let totalMinutes = 0;
    const hoursMatch = durationStr.match(/(\d+)\s*hour/);
    const minsMatch = durationStr.match(/(\d+)\s*min/);
    if (hoursMatch) {
      totalMinutes += parseInt(hoursMatch[1], 10) * 60;
    }
    if (minsMatch) {
      totalMinutes += parseInt(minsMatch[1], 10);
    }
    return totalMinutes * 60 * 1000;
  };

  const handleOptimizeRoute = useCallback(async () => {
    const addresses = deliveryAddresses.split('\n').filter(addr => addr.trim() !== '');
    if (!startAddress.trim()) {
      setError('Please enter a starting warehouse address.');
      return;
    }
    if (addresses.length === 0) {
      setError('Please enter at least one delivery address.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setOptimizedRoute(null);
    setTotalTravelTime(null);
    setGrounding([]);
    setGoogleMapsUrl(null);

    try {
      const result = await optimizeRoute(startAddress, addresses, userLocation);
      
      let cumulativeTime = Date.now();
      const processedRoute = result.route.map(step => {
        const durationMs = parseDuration(step.travelTimeFromPrevious);
        cumulativeTime += durationMs;
        const eta = new Date(cumulativeTime).toLocaleTimeString('en-AU', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        return { ...step, estimatedArrivalTime: eta };
      });
      
      setOptimizedRoute(processedRoute);
      setGrounding(result.groundingChunks);
      setTotalTravelTime(result.totalTravelTime);
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [deliveryAddresses, startAddress, userLocation]);

  const handleSaveRoute = () => {
    if (!optimizedRoute || !totalTravelTime) return;

    const newRoute: SavedRoute = {
      id: `route-${Date.now()}`,
      name: `Route from ${startAddress.split(',')[0]} (${optimizedRoute.length} stops)`,
      startAddress,
      deliveryAddresses: deliveryAddresses.split('\n').filter(addr => addr.trim() !== ''),
      optimizedRoute,
      totalTravelTime,
      createdAt: new Date().toISOString(),
    };
    
    const updatedRoutes = [...savedRoutes, newRoute];
    setSavedRoutes(updatedRoutes);
    localStorage.setItem('deliveryRoutes', JSON.stringify(updatedRoutes));
    alert('Route saved successfully!');
  };

  const handleLoadRoute = (routeToLoad: SavedRoute) => {
    setStartAddress(routeToLoad.startAddress);
    setDeliveryAddresses(routeToLoad.deliveryAddresses.join('\n'));
    setOptimizedRoute(routeToLoad.optimizedRoute);
    setTotalTravelTime(routeToLoad.totalTravelTime);
    setError(null);
    setGrounding([]);
    setIsModalOpen(false);
  };
  
  const handleDeleteRoute = (routeId: string) => {
    const updatedRoutes = savedRoutes.filter(route => route.id !== routeId);
    setSavedRoutes(updatedRoutes);
    localStorage.setItem('deliveryRoutes', JSON.stringify(updatedRoutes));
  };
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      <main className="container mx-auto p-4 md:p-8">
        <header className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center justify-between w-full">
              <div></div> {/* Spacer */}
              <div className="inline-flex items-center justify-center bg-blue-100 dark:bg-blue-900/50 p-3 rounded-full mb-4">
                 <RouteIcon className="w-10 h-10 text-blue-600 dark:text-blue-400" />
              </div>
              <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                  <HistoryIcon className="w-5 h-5" />
                  Saved Routes
              </button>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
            Sydney Delivery Route Optimizer
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Paste your list of Sydney delivery addresses to automatically generate the shortest, most efficient route.
          </p>
        </header>

        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 md:p-8 space-y-8">
          <div className="space-y-6">
            <div>
              <label htmlFor="start-address" className="flex items-center text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <WarehouseIcon className="w-6 h-6 mr-2 text-gray-500" />
                Starting Point (Warehouse)
              </label>
              <input
                id="start-address"
                type="text"
                value={startAddress}
                onChange={(e) => setStartAddress(e.target.value)}
                placeholder="e.g., 123 Industrial Rd, Sydney NSW"
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label htmlFor="delivery-addresses" className="flex items-center text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <MapPinIcon className="w-6 h-6 mr-2 text-gray-500" />
                Delivery Addresses
              </label>
              <textarea
                id="delivery-addresses"
                rows={10}
                value={deliveryAddresses}
                onChange={(e) => setDeliveryAddresses(e.target.value)}
                placeholder="Paste your addresses here, one per line..."
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>
          </div>
          
          {error && (
            <div className="bg-red-100 dark:bg-red-900/50 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded-md" role="alert">
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
          )}
          <div className="pt-2">
            <button
              onClick={handleOptimizeRoute}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 text-lg font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Optimizing...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-6 h-6"/>
                  Optimize Route
                </>
              )}
            </button>
          </div>
        </div>

        {optimizedRoute && (
          <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 md:p-8 mt-8 md:mt-12">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white shrink-0">Your Optimized Route</h2>
               <div className="flex flex-wrap items-center justify-start sm:justify-end gap-3">
                 <button onClick={handleSaveRoute} className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-800 transition-colors">
                    <SaveIcon className="w-5 h-5" /> Save Route
                 </button>
                 <button onClick={handleOptimizeRoute} disabled={isLoading} className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 rounded-lg shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-4 focus:ring-gray-300 dark:focus:ring-gray-600 transition-colors">
                    <RecalculateIcon className="w-5 h-5" /> Recalculate
                 </button>
                 {googleMapsUrl && (
                  <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-300 dark:focus:ring-green-800 transition-colors">
                    <MapIcon className="w-5 h-5" /> Open in Google Maps
                  </a>
                 )}
              </div>
            </div>
            
            {totalTravelTime && (
                <div className="flex items-center gap-2 text-md font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/50 px-4 py-3 rounded-lg mb-6">
                    <ClockIcon className="w-5 h-5" />
                    <span>Est. Total Travel Time: <strong>{totalTravelTime}</strong></span>
                </div>
            )}

            <ol className="relative border-l border-gray-200 dark:border-gray-700 space-y-6">
              {optimizedRoute.map((step, index) => (
                <li key={index} className="ml-8">
                  <span className="absolute flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full -left-4 ring-8 ring-white dark:ring-gray-800 dark:bg-blue-900">
                    <span className="font-bold text-blue-800 dark:text-blue-300">{step.stop}</span>
                  </span>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="flex items-center mb-1 text-lg font-semibold text-gray-900 dark:text-white">
                      {index === 0 ? <WarehouseIcon className="w-5 h-5 mr-2" /> : <MapPinIcon className="w-5 h-5 mr-2" />}
                      {step.address}
                    </h3>
                    <p className="text-base font-normal text-gray-500 dark:text-gray-400">{step.instructions}</p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Travel: <strong>{step.travelTimeFromPrevious}</strong>
                        </span>
                        <span className="flex items-center text-sm font-bold text-blue-600 dark:text-blue-400">
                            <ClockIcon className="w-4 h-4 mr-1.5" />
                            ETA: {step.estimatedArrivalTime}
                        </span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            {grounding.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3">Powered by Google Maps</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">This route was generated using real-time information. For more details, see the following sources:</p>
                <ul className="space-y-2">
                  {grounding.filter(g => g.maps?.uri).map((chunk, index) => (
                    <li key={index}>
                      <a 
                        href={chunk.maps.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {chunk.maps.title}
                        <ExternalLinkIcon className="w-4 h-4" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <footer className="text-center mt-12 py-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-400">
            Built by <a href="https://www.linkedin.com/in/gopal-bogati-4164b7b8/" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">Gopal Bogati</a>
          </p>
        </footer>
      </main>
      
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 id="modal-title" className="text-xl font-bold">Saved Routes</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">&times;</button>
            </div>
            <div className="p-6 overflow-y-auto">
              {savedRoutes.length > 0 ? (
                <ul className="space-y-4">
                  {savedRoutes.map(route => (
                    <li key={route.id} className="p-4 border dark:border-gray-700 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                          <p className="font-semibold">{route.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                              Created on {new Date(route.createdAt).toLocaleDateString()}
                          </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => handleLoadRoute(route)} className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700">Load</button>
                          <button onClick={() => handleDeleteRoute(route.id)} className="p-2 text-red-500 rounded hover:bg-red-100 dark:hover:bg-red-900/50">
                            <TrashIcon className="w-5 h-5" />
                          </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400">No routes saved yet.</p>
              )}
            </div>
             <div className="p-4 border-t dark:border-gray-700 text-right">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">
                  Close
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
