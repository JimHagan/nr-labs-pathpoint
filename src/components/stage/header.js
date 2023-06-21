import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

import { HeadingText, Icon, Popover, PopoverTrigger, PopoverBody } from 'nr1';
import { EditInPlace } from '@newrelic/nr-labs-components';

import IconsLib from '../icons-lib';
import DeleteStageModal from '../delete-stage-modal';
import { MODES, STATUSES } from '../../constants';

const StageHeader = ({
  name = 'Stage',
  status = STATUSES.UNKNOWN,
  related = {},
  onUpdate,
  onDelete,
  mode = MODES.KIOSK,
}) => {
  const [deleteModalHidden, setDeleteModalHidden] = useState(true);

  const shape = useMemo(() => {
    const { target, source } = related;
    if (!target && !source) return '';
    if (target && source) return 'has-target has-source';
    if (target) return 'has-target';
    if (source) return 'has-source';
    return '';
  }, [related]);

  const linkClickHandler = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();

    if (type === 'delete') {
      setDeleteModalHidden(false);
    }
  });

  return mode === MODES.EDIT ? (
    <div className={`stage-header edit ${shape}`}>
      <IconsLib type={IconsLib.TYPES.HANDLE} />
      <HeadingText className="name">
        <EditInPlace
          value={name}
          setValue={(newName) =>
            newName !== name && onUpdate ? onUpdate({ name: newName }) : null
          }
        />
      </HeadingText>
      <span className="last-col">
        <Popover>
          <PopoverTrigger>
            <Icon type={Icon.TYPE.INTERFACE__OPERATIONS__MORE} />
          </PopoverTrigger>
          <PopoverBody placementType={PopoverBody.PLACEMENT_TYPE.BOTTOM_END}>
            <div className="dropdown-links">
              <div className="dropdown-link destructive">
                <a href="#" onClick={(e) => linkClickHandler(e, 'delete')}>
                  Delete stage
                </a>
              </div>
              <div className="dropdown-link">
                <a href="#">Change shape</a>
              </div>
            </div>
          </PopoverBody>
        </Popover>
      </span>
      <DeleteStageModal
        name={name}
        hidden={deleteModalHidden}
        onConfirm={onDelete}
        onClose={() => setDeleteModalHidden(true)}
      />
    </div>
  ) : (
    <div className={`stage-header ${status} ${shape}`}>
      <HeadingText className="name">{name}</HeadingText>
    </div>
  );
};

StageHeader.propTypes = {
  name: PropTypes.string,
  status: PropTypes.oneOf(Object.values(STATUSES)),
  related: PropTypes.shape({
    target: PropTypes.bool,
    source: PropTypes.bool,
  }),
  onUpdate: PropTypes.func,
  onDelete: PropTypes.func,
  mode: PropTypes.oneOf(Object.values(MODES)),
};

export default StageHeader;