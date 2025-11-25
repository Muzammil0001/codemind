import { MainApp } from './components/MainApp';
import { AppProviders } from './contexts/AppProviders';

const App = () => (
  <AppProviders>
    <MainApp />
  </AppProviders>
);

export default App;

