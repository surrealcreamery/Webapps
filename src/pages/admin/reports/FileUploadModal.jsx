import React from 'react';
import ReactDOM from 'react-dom'; // Import ReactDOM for the Portal
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import GoogleIcon from '@mui/icons-material/Google';
import PropTypes from 'prop-types';

// --- DEFINE THE FOLDER YOU WANT TO OPEN IN GOOGLE DRIVE ---
const TARGET_FOLDER_NAME = 'Reports';

// --- useScript hook logic is now included directly in this file ---
const useScript = (url, onload) => {
  React.useEffect(() => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.defer = true;
    script.onload = onload;

    document.body.appendChild(script);

    return () => {
      // Check if the script is still in the body before trying to remove it
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [url, onload]);
};

const FileUploadModal = ({
  open,
  onClose,
  onProcessFile,
  setSnackbar,
  googleApiKey,
  googleClientId,
}) => {
  const [pickedFile, setPickedFile] = React.useState(null);
  const [oauthToken, setOauthToken] = React.useState(null);
  const [isPickerLoaded, setIsPickerLoaded] = React.useState(false);
  const [isFindingFolder, setIsFindingFolder] = React.useState(false);

  // Load the Google 'gsi' client for authentication
  useScript('https://accounts.google.com/gsi/client', () => {
    if (window.google?.accounts?.oauth2) {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope:
          'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
        callback: (tokenResponse) => {
          setOauthToken(tokenResponse);
        },
      });
      window.tokenClient = tokenClient;
    }
  });

  // Load the Google 'gapi' client for the picker API
  useScript('https://apis.google.com/js/api.js', () => {
    if (window.gapi) {
      window.gapi.load('picker', () => {
        setIsPickerLoaded(true);
      });
    }
  });

  const handleAuthClick = () => {
    if (window.tokenClient) {
      window.tokenClient.requestAccessToken({ prompt: 'select_account' });
    } else {
      setSnackbar({
        open: true,
        message: 'Google Auth is not ready yet.',
        severity: 'error',
      });
    }
  };

  const createPicker = async () => {
    if (!isPickerLoaded || !oauthToken) {
      setSnackbar({
        open: true,
        message: 'Please sign in and wait for the Picker to load.',
        severity: 'error',
      });
      return;
    }
    setIsFindingFolder(true);
    let folderId = null;

    try {
      const query = `name='${TARGET_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          query,
        )}`,
        {
          headers: { Authorization: `Bearer ${oauthToken.access_token}` },
        },
      );
      if (!response.ok) throw new Error('Failed to search for folder.');

      const data = await response.json();
      if (data.files && data.files.length > 0) {
        folderId = data.files[0].id;
      } else {
        setSnackbar({
          open: true,
          message: `Folder named "${TARGET_FOLDER_NAME}" not found in your Google Drive.`,
          severity: 'error',
        });
        setIsFindingFolder(false);
        return;
      }
    } catch (error) {
      console.error(error);
      setSnackbar({
        open: true,
        message: `Error finding folder: ${error.message}`,
        severity: 'error',
      });
      setIsFindingFolder(false);
      return;
    }

    setIsFindingFolder(false);

    const view = new window.google.picker.View(window.google.picker.ViewId.DOCS);
    view.setMimeTypes(
      'application/vnd.google-apps-spreadsheet,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv',
    );
    if (folderId) {
      view.setParent(folderId);
    }

    const picker = new window.google.picker.PickerBuilder()
      .setAppId(googleClientId.split('-')[0])
      .setOAuthToken(oauthToken.access_token)
      .addView(view)
      .setDeveloperKey(googleApiKey)
      .setCallback((data) => {
        if (data[window.google.picker.Action.PICKED]) {
          const doc = data[window.google.picker.Response.DOCUMENTS][0];
          setPickedFile({ id: doc.id, name: doc.name });
        }
      })
      .build();
    picker.setVisible(true);
  };

  const handleProcess = () => {
    if (!pickedFile) return;
    onProcessFile(pickedFile);
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setPickedFile(null);
      setOauthToken(null);
    }, 200);
  };
  
  // If the modal isn't open, render nothing.
  if (!open) {
    return null;
  }

  // --- NEW: Use a Portal to render the Dialog at the top of the document body ---
  return ReactDOM.createPortal(
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        Select Report from Google Drive
        <IconButton aria-label="close" onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          minHeight: 280,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
        }}
      >
        <Box sx={{ width: '100%', textAlign: 'center' }}>
          {!oauthToken ? (
            <>
              <Typography sx={{ mb: 2 }}>
                Please sign in with Google to access your Drive files.
              </Typography>
              <Button
                variant="contained"
                startIcon={<GoogleIcon />}
                onClick={handleAuthClick}
              >
                Sign in with Google
              </Button>
            </>
          ) : !pickedFile ? (
            <>
              <Typography sx={{ mb: 2 }}>
                You are signed in. You can now select a file.
              </Typography>
              <Button
                variant="contained"
                onClick={createPicker}
                disabled={isFindingFolder}
              >
                {isFindingFolder ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  `Select from "${TARGET_FOLDER_NAME}" Folder`
                )}
              </Button>
            </>
          ) : (
            <Paper variant="outlined" sx={{ p: 3 }}>
              <CheckCircleOutlineIcon
                color="success"
                sx={{ fontSize: 40, mb: 1 }}
              />
              <Typography>File Selected:</Typography>
              <Typography
                component="div"
                sx={{ fontWeight: 'bold', mt: 1, wordBreak: 'break-all' }}
              >
                {pickedFile.name}
              </Typography>
              <Typography
                variant="caption"
                display="block"
                color="text.secondary"
              >
                ID: {pickedFile.id}
              </Typography>
            </Paper>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleProcess}
          variant="contained"
          disabled={!pickedFile}
        >
          Process File
        </Button>
      </DialogActions>
    </Dialog>,
    document.body // Target the document body for rendering
  );
};

FileUploadModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onProcessFile: PropTypes.func.isRequired,
  setSnackbar: PropTypes.func.isRequired,
  googleApiKey: PropTypes.string.isRequired,
  googleClientId: PropTypes.string.isRequired,
};

export default FileUploadModal;