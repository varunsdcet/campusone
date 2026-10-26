// Global test setup. __DEV__ is provided by the RN jest preset.
import { appConfig } from '../src/config/appConfig';

// The suites exercise the mock services; the shipped app defaults to the live API.
appConfig.mode = 'mock';
