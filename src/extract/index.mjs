import extractDependencies from "./extract-dependencies.mjs";
import extractStats from "./extract-stats.mjs";
import gatherInitialSources from "./gather-initial-sources.mjs";
import clearCaches from "./clear-caches.mjs";
import { bus } from "#utl/bus.mjs";

/**
 * @import {IStrictCruiseOptions} from "../../types/options.mjs";
 * @import { IModule, IResolveOptions, ITranspileOptions } from "../../types/dependency-cruiser.mjs";
 */

/* eslint max-params:0 , max-lines-per-function:0*/
function extractRecursive(
  pFileName,
  pCruiseOptions,
  pVisited,
  pDepth,
  pResolveOptions,
  pTranspileOptions,
) {
  pVisited.add(pFileName);
  const lDependencies =
    pCruiseOptions.maxDepth <= 0 || pDepth < pCruiseOptions.maxDepth
      ? extractDependencies(
          pFileName,
          pCruiseOptions,
          pResolveOptions,
          pTranspileOptions,
        )
      : [];
  const lReturnValue = [
    {
      source: pFileName,
      ...(pCruiseOptions.experimentalStats
        ? {
            experimentalStats: extractStats(
              pFileName,
              pCruiseOptions,
              pTranspileOptions,
            ),
          }
        : {}),
      dependencies: lDependencies,
    },
  ];

  // eslint-disable-next-line budapestian/local-variable-pattern
  for (const { resolved, followable, matchesDoNotFollow } of lDependencies) {
    if (followable && !matchesDoNotFollow && !pVisited.has(resolved)) {
      lReturnValue.push(
        ...extractRecursive(
          resolved,
          pCruiseOptions,
          pVisited,
          pDepth + 1,
          pResolveOptions,
          pTranspileOptions,
        ),
      );
    }
  }
  return lReturnValue;
}

function extractFileDirectoryArray(
  pFileDirectoryArray,
  pCruiseOptions,
  pResolveOptions,
  pTranspileOptions,
) {
  const lVisited = new Set();

  bus.debug("extract: gather initial sources");
  const lInitialSources = gatherInitialSources(
    pFileDirectoryArray,
    pCruiseOptions,
  );

  bus.debug("extract: visit dependencies");
  const lResult = [];
  for (const lFilename of lInitialSources) {
    if (!lVisited.has(lFilename)) {
      lResult.push(
        ...extractRecursive(
          lFilename,
          pCruiseOptions,
          lVisited,
          0,
          pResolveOptions,
          pTranspileOptions,
        ),
      );
    }
  }
  return lResult;
}

function toDependencyAsModule(pToListItem) {
  return {
    source: pToListItem.resolved,
    followable: pToListItem.followable,
    coreModule: pToListItem.coreModule,
    couldNotResolve: pToListItem.couldNotResolve,
    matchesDoNotFollow: pToListItem.matchesDoNotFollow,
    dependencyTypes: pToListItem.dependencyTypes,
    dependencies: [],
  };
}

/**
 * Returns the input modules, inserting a module entry after each module for
 * every unfollowed dependency (such as core modules, npm packages, or
 * unresolvable imports) whose source has not appeared earlier in the list.
 *
 * @param {Partial<IModule>[]} pModules
 * @returns {Partial<IModule>[]}
 */
function complete(pModules) {
  const lReturnValue = [];
  // Tracking seen sources in a Set keeps this linear in the number of
  // modules. Scanning the output list directly is quadratic and dominates
  // the run time on code bases with 100k+ modules.
  const lSeenSources = new Set();

  for (const lModule of pModules) {
    const lUnfollowedDependencies = lModule.dependencies
      .filter(
        ({ followable, resolved }) =>
          !followable && !lSeenSources.has(resolved),
      )
      .map(toDependencyAsModule);

    lReturnValue.push(lModule, ...lUnfollowedDependencies);
    lSeenSources.add(lModule.source);
    for (const { source } of lUnfollowedDependencies) {
      lSeenSources.add(source);
    }
  }
  return lReturnValue;
}

function removeExcludedDynamicDependencies(pModule, pExclude) {
  // no need to do the 'path' thing as that was addressed in extractFileDirectoryArray already
  return {
    ...pModule,
    dependencies: pModule.dependencies.filter(
      ({ dynamic }) =>
        !Object.hasOwn(pExclude, "dynamic") || pExclude.dynamic !== dynamic,
    ),
  };
}

/**
 * Recursively runs through the modules matching the pFileDirectoryArray and
 * returns an array of all the modules it finds that way.
 *
 * @param {string[]} pFileDirectoryArray
 * @param {IStrictCruiseOptions} pCruiseOptions
 * @param {IResolveOptions} pResolveOptions
 * @param {ITranspileOptions} pTranspileOptions
 * @returns {Partial<IModule[]>}
 */
export default function extract(
  pFileDirectoryArray,
  pCruiseOptions,
  pResolveOptions,
  pTranspileOptions,
) {
  clearCaches();

  const lReturnValue = complete(
    extractFileDirectoryArray(
      pFileDirectoryArray,
      pCruiseOptions,
      pResolveOptions,
      pTranspileOptions,
    ),
  ).map((pModule) =>
    removeExcludedDynamicDependencies(pModule, pCruiseOptions.exclude),
  );
  pResolveOptions.fileSystem.purge();
  clearCaches();
  return lReturnValue;
}
