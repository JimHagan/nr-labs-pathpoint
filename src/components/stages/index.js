import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import { Button, HeadingText } from 'nr1';

import { Stage } from '../';
import { useFetchServiceLevels } from '../../hooks';
import { MODES, STATUSES } from '../../constants';
import {
  addSignalStatuses,
  annotateStageWithStatuses,
  uniqueSignalGuidsInStages,
} from '../../utils';

const Stages = ({ stages = [], onUpdate, mode = MODES.INLINE }) => {
  const [stagesWithStatuses, setStagesWithStatuses] = useState([]);
  const [guids, setGuids] = useState([]);
  const dragItemIndex = useRef();
  const dragOverItemIndex = useRef();
  const { data: serviceLevelsData, error: serviceLevelsError } =
    useFetchServiceLevels({ guids });

  useEffect(() => {
    setStagesWithStatuses(stages);
    setGuids(uniqueSignalGuidsInStages(stages));
  }, [stages]);

  useEffect(() => {
    if (!Object.keys(serviceLevelsData).length) return;
    const stagesWithSLData = addSignalStatuses(stages, serviceLevelsData);
    setStagesWithStatuses(stagesWithSLData.map(annotateStageWithStatuses));
  }, [serviceLevelsData]);

  useEffect(() => {
    if (serviceLevelsError)
      console.error('Error fetching service levels', serviceLevelsError);
  }, [serviceLevelsError]);

  const addStageHandler = () =>
    onUpdate
      ? onUpdate({
          stages: [
            ...stages,
            {
              name: 'New Stage',
              levels: [],
            },
          ],
        })
      : null;

  const updateStageHandler = (updatedStage, index) => {
    const updatedStages = [...stages];
    updatedStages[index] = updatedStage;
    if (onUpdate) onUpdate({ stages: updatedStages });
  };

  const deleteStageHandler = (index) => {
    const updatedStages = stages.filter((_, i) => i !== index);
    if (onUpdate) onUpdate({ stages: updatedStages });
  };

  const dragStartHandler = (e, index) => {
    dragItemIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const dragOverHandler = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverItemIndex.current = index;
  };

  const dropHandler = (e) => {
    e.preventDefault();
    const itemIndex = dragItemIndex.current;
    const overIndex = dragOverItemIndex.current;
    if (
      !Number.isInteger(itemIndex) ||
      !Number.isInteger(overIndex) ||
      itemIndex === overIndex
    )
      return;
    const updatedStages = [...stages];
    const item = updatedStages[itemIndex];
    updatedStages.splice(itemIndex, 1);
    updatedStages.splice(overIndex, 0, item);
    if (onUpdate) onUpdate({ stages: updatedStages });
    dragItemIndex.current = null;
    dragOverItemIndex.current = null;
  };

  return (
    <>
      <div className="stages-header">
        <HeadingText type={HeadingText.TYPE.HEADING_4}>Stages</HeadingText>
        {mode === MODES.EDIT ? (
          <Button
            type={Button.TYPE.SECONDARY}
            sizeType={Button.SIZE_TYPE.SMALL}
            iconType={Button.ICON_TYPE.INTERFACE__SIGN__PLUS__V_ALTERNATE}
            onClick={addStageHandler}
          >
            Add a stage
          </Button>
        ) : null}
      </div>
      <div className="stages">
        {(stagesWithStatuses || []).map(
          (
            { name = '', levels = [], related = {}, status = STATUSES.UNKNOWN },
            i
          ) => (
            <Stage
              key={i}
              name={name}
              levels={levels}
              related={related}
              status={status}
              mode={mode}
              onUpdate={(updateStage) => updateStageHandler(updateStage, i)}
              onDelete={() => deleteStageHandler(i)}
              onDragStart={(e) => dragStartHandler(e, i)}
              onDragOver={(e) => dragOverHandler(e, i)}
              onDrop={(e) => dropHandler(e)}
            />
          )
        )}
      </div>
    </>
  );
};

Stages.propTypes = {
  stages: PropTypes.array,
  onUpdate: PropTypes.func,
  mode: PropTypes.oneOf(Object.values(MODES)),
};

export default Stages;
