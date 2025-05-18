import * as THREE from 'three';

export function BoneFilters(action, { filterBones = null, excludeBones = null }) {
    if (!action._originalBindings) {
        action._originalBindings = [...action._propertyBindings];
        action._originalInterpolants = [...action._interpolants];
    }
    if (!filterBones && !excludeBones) {
        action._propertyBindings = action._originalBindings;
        action._interpolants = action._originalInterpolants;
        return;
    }
    if (filterBones) {
        // NOTE Run animation only for these specific bones https://discourse.threejs.org/t/animation-replace-blend-mode/51804/2
        const filteredBindings = [];
        const filteredInterpolants = [];
        const bindings = action._propertyBindings || [];
        const interpolants = action._interpolants || [];

        bindings.forEach((propertyMixer, index) => {
            const { binding } = propertyMixer;
            if (binding && binding.targetObject && !filterBones.includes(binding.targetObject.name)) {
                return;
            } else {
                filteredBindings.push(propertyMixer);
                filteredInterpolants.push(interpolants[index]);
            }
        });

        action._propertyBindings = filteredBindings;
        action._interpolants = filteredInterpolants;
    } else if (excludeBones) {
        const filteredBindings = [];
        const filteredInterpolants = [];
        const bindings = action._propertyBindings || [];
        const interpolants = action._interpolants || [];

        bindings.forEach((propertyMixer, index) => {
            const { binding } = propertyMixer;
            if (!(binding && binding.targetObject && excludeBones.includes(binding.targetObject.name))) {
                filteredBindings.push(propertyMixer);
                filteredInterpolants.push(interpolants[index]);
            }
        });

        action._propertyBindings = filteredBindings;
        action._interpolants = filteredInterpolants;
    }
}

export function lerpAngle(a, b, t) {
    const delta = ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return a + delta * t;
}