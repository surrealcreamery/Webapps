import { CONFIG } from 'src/global-config';

import { ButtonsView } from 'src/sections/_examples/mui/button-view';

// ----------------------------------------------------------------------

export const metadata = { title: `Buttons | MUI - ${CONFIG.appName}` };

export default function Page() {
  return <ButtonsView />;
}
