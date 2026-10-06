import LiveBoard from './live-board';
import Checkins from './checkins';
import Report from './report';
import Settings from './settings';

export const sessionTabs = [
  { id: 'live-board', label: 'Live Board', component: LiveBoard },
  { id: 'checkins', label: 'Check-ins', component: Checkins },
  { id: 'report', label: 'Report', component: Report },
  { id: 'settings', label: 'Settings', component: Settings },
];
