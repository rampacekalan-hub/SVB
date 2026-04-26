import { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { VotingScreen } from './src/screens/VotingScreen';
import { getAccessToken } from './src/api';

const Stack = createNativeStackNavigator();

export default function App() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    getAccessToken().then((t) => {
      setLoggedIn(!!t);
      setBootstrapped(true);
    });
  }, []);

  if (!bootstrapped) return null;

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator initialRouteName={loggedIn ? 'Home' : 'Login'}>
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Prihlásenie' }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Floory' }} />
        <Stack.Screen name="Voting" component={VotingScreen} options={{ title: 'Hlasovanie' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
