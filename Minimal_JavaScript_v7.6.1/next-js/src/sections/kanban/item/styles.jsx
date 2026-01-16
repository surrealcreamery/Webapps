import { m } from 'framer-motion';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import AvatarGroup, { avatarGroupClasses } from '@mui/material/AvatarGroup';

import { Iconify } from 'src/components/iconify';
import { imageClasses } from 'src/components/image';

import { kanbanClasses } from '../classes';

// ----------------------------------------------------------------------

export const DropIndicator = styled('div')(({ theme }) => ({
  flexShrink: 0,
  borderRadius: 'var(--kanban-item-radius)',
  backgroundColor: theme.vars.palette.action.hover,
  border: `dashed 1px ${theme.vars.palette.shared.paperOutlined}`,
}));

export const ItemPreview = styled('div')(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.vars.palette.background.paper,
}));

/* **********************************************************************
 * Item elements
 * **********************************************************************/
export const ItemRoot = styled(m.li)(({ theme }) => {
  const transitionKey = 'moveFlash';

  return {
    [`@keyframes ${transitionKey}`]: {
      from: { transform: 'scale(0.98)' },
      to: { transform: 'scale(1)' },
    },
    flexShrink: 0,
    cursor: 'grab',
    display: 'flex',
    position: 'relative',
    flexDirection: 'column',
    borderRadius: 'var(--kanban-item-radius)',
    backgroundColor: theme.vars.palette.common.white,
    transition: theme.transitions.create(['filter', 'box-shadow', 'background-color']),
    ...theme.applyStyles('dark', {
      backgroundColor: theme.vars.palette.grey[900],
    }),
    '&:hover': {
      boxShadow: theme.vars.customShadows.z8,
    },
    [`&.${kanbanClasses.state.dragging}`]: {
      filter: 'grayscale(1)',
      '& > *': { opacity: 0.4 },
    },
    [`&.${kanbanClasses.state.draggingAndLeftSelf}`]: {
      display: 'none',
    },
    [`&.${kanbanClasses.state.flash}`]: {
      animation: `${transitionKey} 320ms ease-in-out`,
    },
    [`&.${kanbanClasses.state.openDetails}`]: {
      backgroundColor: theme.vars.palette.action.selected,
      '& > *': { opacity: 0.8 },
    },
  };
});

export const ItemContent = styled('div')(({ theme }) => ({
  position: 'relative',
  padding: theme.spacing(2.5, 2),
}));

// ----------------------------------------------------------------------

export function ItemName({ name, sx, ...other }) {
  return (
    <Typography
      noWrap
      component="span"
      variant="subtitle2"
      sx={[{ display: 'block' }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...other}
    >
      {name}
    </Typography>
  );
}

// ----------------------------------------------------------------------

export function ItemImage({ sx, attachments, ...other }) {
  if (!attachments.length) return null;

  return (
    <Box
      sx={[{ pt: 1, px: 1, pointerEvents: 'none' }, ...(Array.isArray(sx) ? sx : [sx])]}
      {...other}
    >
      <Box
        component="img"
        className={imageClasses.root}
        alt={attachments[0]}
        src={attachments[0]}
        sx={[
          (theme) => ({
            width: 1,
            borderRadius: 1.5,
            height: 'auto',
            aspectRatio: '4/3',
            objectFit: 'cover',
            transition: theme.transitions.create(['opacity', 'filter'], {
              duration: theme.transitions.duration.shortest,
            }),
          }),
        ]}
      />
    </Box>
  );
}

// ----------------------------------------------------------------------

export function ItemStatus({ sx, status, ...other }) {
  return (
    <Iconify
      icon={
        (status === 'low' && 'solar:double-alt-arrow-down-bold-duotone') ||
        (status === 'medium' && 'solar:double-alt-arrow-right-bold-duotone') ||
        'solar:double-alt-arrow-up-bold-duotone'
      }
      sx={[
        {
          top: 4,
          right: 4,
          position: 'absolute',
          color: 'error.main',
          ...(status === 'low' && { color: 'info.main' }),
          ...(status === 'medium' && { color: 'warning.main' }),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    />
  );
}

// ----------------------------------------------------------------------

export function ItemInfo({ sx, assignee, comments, attachments, ...other }) {
  const hasComments = !!comments.length;
  const hasAssignee = !!assignee.length;
  const hasAttachments = !!attachments.length;

  if (!hasComments && !hasAttachments && !hasAssignee) return null;

  const renderInfo = (icon, count) => (
    <Box
      sx={{
        gap: 0.25,
        display: 'flex',
        alignItems: 'center',
        typography: 'caption',
        color: 'text.disabled',
      }}
    >
      <Iconify width={16} icon={icon} />
      <Box component="span">{count}</Box>
    </Box>
  );

  return (
    <Box
      sx={[
        {
          mt: 2,
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'none',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {(hasComments || hasAttachments) && (
        <Box sx={{ gap: 1, display: 'flex', alignItems: 'center' }}>
          {hasComments && renderInfo('solar:chat-round-dots-bold', comments.length)}
          {hasAttachments && renderInfo('eva:attach-2-fill', attachments.length)}
        </Box>
      )}

      {hasAssignee && (
        <>
          <Box component="span" sx={{ flexGrow: 1 }} />
          <AvatarGroup
            sx={{
              [`& .${avatarGroupClasses.avatar}`]: {
                width: 24,
                height: 24,
              },
            }}
          >
            {assignee.map((user) => (
              <Avatar key={user.id} alt={user.name} src={user.avatarUrl} />
            ))}
          </AvatarGroup>
        </>
      )}
    </Box>
  );
}
