import { useBoolean } from 'minimal-shared/hooks';
import { mergeClasses } from 'minimal-shared/utils';
import { useState, useEffect, cloneElement } from 'react';

import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Drawer, { drawerClasses } from '@mui/material/Drawer';

import { usePathname } from 'src/routes/hooks';

import { Iconify } from '../../iconify';
import { Nav, NavUl } from '../components';
import { Scrollbar } from '../../scrollbar';
import { NavListDrawer } from './nav-list-drawer';
import { NavListCollapse } from './nav-list-collapse';
import { megaMenuVars, megaMenuClasses } from '../styles';

// ----------------------------------------------------------------------

export function MegaMenuMobile({
  sx,
  data,
  slots,
  render,
  className,
  slotProps,
  cssVars: overridesVars,
  submenuMode = 'drawer',
  ...other
}) {
  const theme = useTheme();
  const pathname = usePathname();

  const drawerOpen = useBoolean();

  const [expandedPath, setExpandedPath] = useState(null);
  const [lastExpandedPath, setLastExpandedPath] = useState(null);

  const cssVars = { ...megaMenuVars(theme, 'mobile'), ...overridesVars };

  useEffect(() => {
    if (drawerOpen.value) {
      drawerOpen.onFalse();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const renderMenuButton = () =>
    slots?.button ? (
      cloneElement(slots.button, {
        onClick: drawerOpen.onTrue,
      })
    ) : (
      <IconButton onClick={drawerOpen.onTrue}>
        <Iconify icon="custom:menu-duotone" width={24} />
      </IconButton>
    );

  const navListProps = {
    render,
    cssVars,
    slotProps,
  };

  const renderNavList = (list) => {
    if (submenuMode === 'collapse') {
      return (
        <NavListCollapse
          key={list.title}
          {...navListProps}
          data={list}
          expandedPath={expandedPath}
          setExpandedPath={setExpandedPath}
          setLastExpandedPath={setLastExpandedPath}
        />
      );
    }

    return (
      <NavListDrawer
        key={list.title}
        {...navListProps}
        data={list}
        onCloseDrawerRoot={drawerOpen.onFalse}
      />
    );
  };

  return (
    <>
      {renderMenuButton()}

      <Drawer
        open={drawerOpen.value}
        onClose={() => {
          drawerOpen.onFalse();
          if (submenuMode === 'collapse' && lastExpandedPath) {
            setExpandedPath(lastExpandedPath);
          }
        }}
        sx={{
          ...cssVars,
          [`& .${drawerClasses.paper}`]: {
            display: 'flex',
            flexDirection: 'column',
            width: 'var(--nav-width)',
          },
        }}
      >
        {slots?.topArea}

        <Scrollbar fillContent>
          <Nav className={mergeClasses([megaMenuClasses.mobile, className])} sx={sx} {...other}>
            <NavUl sx={{ gap: 'var(--nav-item-gap)' }}>
              {data.map((list) => renderNavList(list))}
            </NavUl>
          </Nav>
        </Scrollbar>

        {slots?.bottomArea}
      </Drawer>
    </>
  );
}
