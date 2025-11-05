export interface RouteStep {
  stop: number;
  address: string;
  instructions: string;
  travelTimeFromPrevious: string;
}

export interface GroundingChunk {
  maps: {
    title: string;
    uri: string;
  };
}

export interface ProcessedRouteStep extends RouteStep {
  estimatedArrivalTime: string;
}

export interface SavedRoute {
  id: string;
  name: string;
  startAddress: string;
  deliveryAddresses: string[];
  optimizedRoute: ProcessedRouteStep[];
  totalTravelTime: string;
  createdAt: string;
}
