import { createContext, useContext } from "react";

interface TourContextValue {
  startTour: () => void;
  isTourActive: boolean;
}

const TourContext = createContext<TourContextValue>({
  startTour: () => {},
  isTourActive: false,
});

export function TourProvider({ children }: { children: React.ReactNode }) {
  return (
    <TourContext.Provider value={{ startTour: () => {}, isTourActive: false }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  return useContext(TourContext);
}

export default TourProvider;
