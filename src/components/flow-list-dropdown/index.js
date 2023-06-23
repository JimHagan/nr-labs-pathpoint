import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import { Icon } from 'nr1';

import IconsLib from '../icons-lib';

const FlowListDropdown = ({ flows = [], onClick = () => null }) => {
  const [searchPattern, setSearchPattern] = useState('');
  const [filteredFlows, setFilteredFlows] = useState([]);

  useEffect(() => {
    setFilteredFlows(
      flows.length && searchPattern.trim()
        ? flows.filter((item) =>
            `${item.document.name} ${item.document.stages
              .map((s) => s.name)
              .join(' ')}`
              .toLowerCase()
              .includes(searchPattern.toLowerCase())
          )
        : flows
    );
  }, [searchPattern]);

  return (
    <div className="flowlist-pulldown">
      <div className="flowlist-search-bar">
        <Icon type={Icon.TYPE.INTERFACE__OPERATIONS__SEARCH} />
        <input
          style={{ backgroundColor: '#ffffff' }}
          placeholder={'Search for Flow'}
          onChange={(evt) => {
            setSearchPattern(evt.target.value);
          }}
        />
      </div>

      <div className="flowlist-pulldown-content">
        {filteredFlows.map((flow, flowIndex) => (
          <div
            key={`flow-${flowIndex}`}
            className="flowlist-row"
            onClick={() => {
              onClick(flow.id);
            }}
          >
            {flow.document.imageUrl ? (
              <img src={flow.document.imageUrl} />
            ) : (
              <IconsLib
                className="iconslib"
                type={IconsLib.TYPES.PATHPOINT_LOGO}
              />
            )}
            {flow.document.name}
          </div>
        ))}
      </div>
    </div>
  );
};

FlowListDropdown.propTypes = {
  flows: PropTypes.array,
  onClick: PropTypes.func,
};

export default FlowListDropdown;