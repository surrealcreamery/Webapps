/**
 * External dependencies.
 */
import { useRef } from 'react';

const SkipToContent = () => {
	const skipToContentButtonRef = useRef(null);
	const targetSectionRef = useRef(null);

	/**
	 * Handle skip to content.
	 * 
	 * @param {Object} event 
	 * @returns {Void}
	 */
	const handleSkipToContent = (event) => {
		const targetSection = document.getElementById('skip-to-content');
		const skipToContentButton = skipToContentButtonRef.current;

		if (targetSection && skipToContentButton) {
			window.scrollTo({
				top: targetSection.offsetTop,
				left: 0,		
				behavior: 'smooth',
			});

			skipToContentButton.blur();

			const focusableElements = targetSection.querySelectorAll(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);

			if (focusableElements.length > 0) {
				focusableElements[0].focus();
			}
		}

		event.preventDefault();
	};

	return (
		<div className="block-button">
			<div className="shell">
				<a
					href="#skip-to-content"
					className="btn js-skip-to-content"
					ref={skipToContentButtonRef}
					onClick={handleSkipToContent}
				>
					Skip to Content
				</a>
			</div>
		</div>
 	);
};

export default SkipToContent;
